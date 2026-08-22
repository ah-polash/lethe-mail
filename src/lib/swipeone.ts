import { prisma } from "./db";

async function getSwipeOneConfig() {
  return prisma.swipeOneConfig.findFirst({ where: { isActive: true } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// SwipeOne rate-limits bursts (HTTP 429). Paginating a large segment fires many
// requests in a row, so retry those — and transient 5xx — with exponential
// backoff instead of failing the whole campaign send.
const MAX_ATTEMPTS = 5;

async function swipeOneRequest(method: string, endpoint: string, body?: unknown) {
  const config = await getSwipeOneConfig();
  if (!config) throw new Error("SwipeOne not configured");

  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${baseUrl}/api${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.ok) return res.json();

    const text = await res.text();
    lastError = `SwipeOne API error ${res.status}: ${text}`;

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) break;

    // Honour Retry-After when the server sends it, else back off 1s, 2s, 4s, 8s
    // (plus jitter so parallel senders don't retry in lockstep).
    const retryAfter = Number(res.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2 ** (attempt - 1) * 1000 + Math.floor(Math.random() * 250);

    console.warn(`[swipeone] ${res.status} on ${endpoint} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${backoff}ms`);
    await sleep(backoff);
  }

  throw new Error(lastError);
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

    // Gentle pacing between pages — large segments would otherwise fire
    // hundreds of requests back-to-back and hit the rate limit.
    await sleep(200);
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

// SwipeOne's /zapier/contact endpoint REPLACES the contact's tag list on each
// call, so we must merge any new tags with everything we've ever successfully
// pushed (tracked in SwipeOneTagAudit) before sending. Returns the merged set
// that was actually written.
async function pushTagsMergedWithAudit(
  email: string,
  newTags: string[],
  reason: "unsubscribed" | "complained" | "bounced" | null
) {
  const cleaned = Array.from(
    new Set(newTags.map((t) => String(t || "").trim()).filter(Boolean))
  );

  // Merge with prior audit so previously-pushed tags survive.
  let prior: string[] = [];
  try {
    const existing = await prisma.swipeOneTagAudit.findUnique({ where: { email } });
    if (existing?.tags) {
      const arr = JSON.parse(existing.tags);
      if (Array.isArray(arr)) prior = arr.map(String).filter(Boolean);
    }
  } catch { /* ignore */ }

  const merged = Array.from(new Set([...prior, ...cleaned]));
  if (merged.length === 0) return { tagSuccess: false, mergedTags: [] };

  // SwipeOne's /zapier/contact endpoint takes a comma-separated tags string.
  // The array form returns 500, so we don't try it.
  let tagSuccess = false;
  try {
    await swipeOneRequest("POST", `/zapier/contact`, {
      email,
      tags: merged.join(","),
    });
    tagSuccess = true;
  } catch (err) {
    console.warn("[swipeone] tag write failed for", email, err);
  }

  if (tagSuccess) {
    try {
      await prisma.swipeOneTagAudit.upsert({
        where: { email },
        create: { email, tags: JSON.stringify(merged), lastReason: reason },
        update: { tags: JSON.stringify(merged), lastReason: reason },
      });
    } catch (err) {
      console.warn("[swipeone] failed to record tag audit for", email, err);
    }
  }

  return { tagSuccess, mergedTags: merged };
}

async function setMarketingConsentUnsubscribed(email: string) {
  // Flip Email Marketing Consent in a separate, minimal request so a malformed
  // field can't poison the tag write.
  try {
    await swipeOneRequest("POST", `/zapier/contact`, {
      email,
      marketing_email_subscription_status: "unsubscribed",
    });
  } catch (err) {
    console.warn("[swipeone] marketing consent write failed for", email, err);
  }
}

// AWS SES compliance: when a recipient unsubscribes, complains, or hard-bounces,
// we tag the contact in SwipeOne so future automations and exports can exclude
// them, AND flip "Email Marketing Consent" → unsubscribed on the contact record.
// The legacy "user.marketing.opted_out" tag is always included for back-compat
// with existing SwipeOne automations.
async function markContactSuppressed(email: string, reason: "unsubscribed" | "complained" | "bounced") {
  const result = await pushTagsMergedWithAudit(
    email,
    [reason, "user.marketing.opted_out"],
    reason
  );
  await setMarketingConsentUnsubscribed(email);
  return result;
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

// Preference-center helpers: called from /api/unsubscribe whenever a recipient
// updates their per-category preferences. Unlike the SES-webhook helpers
// above, these REPLACE the SwipeOne tag list with exactly the tags the user's
// preferences imply — no merging with prior audit. That way "Category A only"
// produces just the `category-a` tag, not the cumulative set across every
// past submission.
async function setSwipeOneTagsExact(
  email: string,
  desiredTags: string[],
  reason: "unsubscribed" | "complained" | "bounced" | null
) {
  const cleaned = Array.from(
    new Set(desiredTags.map((t) => String(t || "").trim()).filter(Boolean))
  );

  let tagSuccess = false;
  try {
    await swipeOneRequest("POST", `/zapier/contact`, {
      email,
      // Empty string clears all tags on the SwipeOne contact, which is what
      // we want when the user resubscribed from everything.
      tags: cleaned.join(","),
    });
    tagSuccess = true;
  } catch (err) {
    console.warn("[swipeone] tag write failed for", email, err);
  }

  if (tagSuccess) {
    try {
      await prisma.swipeOneTagAudit.upsert({
        where: { email },
        create: { email, tags: JSON.stringify(cleaned), lastReason: reason },
        update: { tags: JSON.stringify(cleaned), lastReason: reason },
      });
    } catch (err) {
      console.warn("[swipeone] failed to record tag audit for", email, err);
    }
  }

  return { tagSuccess, tags: cleaned };
}

export async function tagContactWithCategorySlugs(email: string, slugs: string[]) {
  return setSwipeOneTagsExact(email, slugs, "unsubscribed");
}

export async function tagContactAllEmailsUnsubscribed(email: string) {
  const result = await setSwipeOneTagsExact(
    email,
    ["all_emails", "user.marketing.opted_out"],
    "unsubscribed"
  );
  await setMarketingConsentUnsubscribed(email);
  return result;
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
