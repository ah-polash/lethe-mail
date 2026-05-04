import { prisma } from "./db";

async function getSwipeOneConfig() {
  return prisma.swipeOneConfig.findFirst({ where: { isActive: true } });
}

async function swipeOneRequest(method: string, endpoint: string, body?: unknown) {
  const config = await getSwipeOneConfig();
  if (!config) throw new Error("SwipeOne not configured");

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/api${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SwipeOne API error ${res.status}: ${text}`);
  }

  return res.json();
}

// --- Workspace-based endpoints (Direct API) ---

// Segments
export async function getSegments() {
  const config = await getSwipeOneConfig();
  if (!config || !config.workspaceId) throw new Error("SwipeOne workspace ID not configured");
  const result = await swipeOneRequest("GET", `/workspaces/${config.workspaceId}/segments`);
  return result.data?.segments || [];
}

export async function getSegmentContacts(segmentId: string, limit = 100) {
  const allContacts: { email: string; _id: string; fullName?: string }[] = [];
  let searchAfter: string | undefined;

  // Paginate through all contacts in the segment
  while (true) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (searchAfter) query.set("searchAfter", searchAfter);

    const result = await swipeOneRequest("GET", `/segments/${segmentId}/contacts?${query}`);
    const contacts = result.data?.contacts || [];
    allContacts.push(...contacts);

    if (contacts.length < limit || !result.data?.searchAfter) break;
    searchAfter = result.data.searchAfter;
  }

  return allContacts;
}

// Get contacts from multiple segments (deduplicated by email)
export async function getContactsFromSegments(segmentIds: string[]) {
  const emailMap = new Map<string, { email: string; id: string; name?: string }>();

  for (const segmentId of segmentIds) {
    const contacts = await getSegmentContacts(segmentId);
    for (const contact of contacts) {
      if (contact.email && !emailMap.has(contact.email)) {
        emailMap.set(contact.email, {
          email: contact.email,
          id: contact._id,
          name: contact.fullName,
        });
      }
    }
  }

  return Array.from(emailMap.values());
}

// Contacts
export async function getContacts(limit = 20, searchText?: string) {
  const config = await getSwipeOneConfig();
  if (!config || !config.workspaceId) throw new Error("SwipeOne workspace ID not configured");
  const query = new URLSearchParams({ limit: String(limit) });
  if (searchText) query.set("searchText", searchText);
  const result = await swipeOneRequest("GET", `/workspaces/${config.workspaceId}/contacts?${query}`);
  // Handle various response shapes from SwipeOne
  // Could be { data: { contacts: [...] } } or { data: [...] } or { contacts: [...] }
  const data = result.data ?? result;
  if (Array.isArray(data)) {
    return { contacts: data, count: data.length };
  }
  return {
    contacts: data.contacts || [],
    count: data.count ?? (data.contacts?.length || 0),
  };
}

// --- Zapier-style endpoints ---

// Contact Fields
export async function getContactFields() {
  return swipeOneRequest("GET", `/zapier/fields`);
}

// Create/Update Contact (Zapier-style)
export async function createContact(data: Record<string, unknown>) {
  return swipeOneRequest("POST", `/zapier/contact`, data);
}

// Events
export async function getEvents() {
  return swipeOneRequest("GET", `/zapier/events`);
}

export async function getEventProperties(eventName: string) {
  return swipeOneRequest("GET", `/zapier/events/${encodeURIComponent(eventName)}`);
}

export async function createEvent(data: Record<string, unknown>) {
  return swipeOneRequest("POST", `/zapier/event`, data);
}

// Tag a contact by creating/updating contact with tags.
// SwipeOne's /zapier/contact endpoint replaces the `tags` field on each call,
// so all tags must be passed together in a single comma-separated string.
export async function addTagToContact(email: string, tag: string) {
  return swipeOneRequest("POST", `/zapier/contact`, {
    email,
    tags: tag,
  });
}

export async function addTagsToContact(email: string, tags: string[]) {
  const cleaned = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  if (cleaned.length === 0) return null;
  // SwipeOne's /zapier/contact accepts an array of tags. We try the array form
  // first, and fall back to a comma-separated string if SwipeOne rejects it.
  try {
    return await swipeOneRequest("POST", `/zapier/contact`, {
      email,
      tags: cleaned,
    });
  } catch (err) {
    console.warn("[swipeone] tags array form failed, retrying comma-separated:", err);
    return swipeOneRequest("POST", `/zapier/contact`, {
      email,
      tags: cleaned.join(","),
    });
  }
}

// AWS SES compliance: when a recipient unsubscribes, complains, or hard-bounces,
// we tag the contact in SwipeOne so future automations and exports can exclude
// them, AND flip "Email Marketing Consent" → unsubscribed on the contact record.
// The legacy "user.marketing.opted_out" tag is always included for back-compat
// with existing SwipeOne automations.
async function markContactSuppressed(email: string, reason: "unsubscribed" | "complained" | "bounced") {
  const tags = [reason, "user.marketing.opted_out"];

  // SwipeOne's /zapier/contact endpoint takes a comma-separated tags string.
  // The array form returns 500, so we don't try it.
  let tagSuccess = false;
  try {
    await swipeOneRequest("POST", `/zapier/contact`, {
      email,
      tags: tags.join(","),
    });
    tagSuccess = true;
  } catch (err) {
    console.warn("[swipeone] tag write failed for", email, err);
  }

  // Flip Email Marketing Consent in a separate, minimal request so a malformed
  // field can't poison the tag write above.
  try {
    await swipeOneRequest("POST", `/zapier/contact`, {
      email,
      marketing_email_subscription_status: "unsubscribed",
    });
  } catch (err) {
    console.warn("[swipeone] marketing consent write failed for", email, err);
  }

  // Audit only on successful tag write — union with anything we previously
  // pushed for this contact so the suppression page reflects the full set.
  if (tagSuccess) {
    try {
      const existing = await prisma.swipeOneTagAudit.findUnique({ where: { email } });
      let merged: string[] = [...tags];
      if (existing?.tags) {
        try {
          const prev = JSON.parse(existing.tags);
          if (Array.isArray(prev)) {
            merged = Array.from(new Set([...prev.map(String), ...tags]));
          }
        } catch { /* ignore */ }
      }
      await prisma.swipeOneTagAudit.upsert({
        where: { email },
        create: { email, tags: JSON.stringify(merged), lastReason: reason },
        update: { tags: JSON.stringify(merged), lastReason: reason },
      });
    } catch (err) {
      console.warn("[swipeone] failed to record tag audit for", email, err);
    }
  }

  return { tagSuccess };
}

export async function markContactAsUnsubscribed(email: string) {
  return markContactSuppressed(email, "unsubscribed");
}

export async function markContactAsComplained(email: string) {
  return markContactSuppressed(email, "complained");
}

export async function markContactAsBounced(email: string) {
  return markContactSuppressed(email, "bounced");
}

// Send event for a contact
export async function sendContactEvent(email: string, eventName: string, properties?: Record<string, unknown>) {
  return swipeOneRequest("POST", `/zapier/event`, {
    contact: email,
    event: eventName,
    ...(properties ? { properties } : {}),
  });
}

// Test connection by fetching fields
export async function testConnection() {
  return swipeOneRequest("GET", `/zapier/fields`);
}
