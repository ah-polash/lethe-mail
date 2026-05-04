import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getContacts as getSwipeOneContacts } from "@/lib/swipeone";

interface SwipeOneSearchContact {
  email?: string;
  email_address?: string;
  fullName?: string;
  full_name?: string;
  name?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  tags?: unknown;
  properties?: Record<string, unknown>;
}

function pickTags(c: SwipeOneSearchContact): string[] {
  const collect = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) {
      return v
        .flatMap((x) => {
          if (typeof x === "string") return [x.trim()];
          if (x && typeof x === "object") {
            const o = x as Record<string, unknown>;
            for (const k of ["name", "tag", "label", "value", "title"]) {
              const val = o[k];
              if (typeof val === "string" && val.trim()) return [val.trim()];
            }
          }
          return [];
        })
        .filter(Boolean);
    }
    if (typeof v === "string" && v.trim()) {
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  const candidates: unknown[] = [];
  const obj = c as Record<string, unknown>;
  for (const key of ["tags", "Tags", "tag", "tagList", "tag_list"]) {
    if (obj[key] !== undefined) candidates.push(obj[key]);
  }
  if (c.properties && typeof c.properties === "object") {
    const p = c.properties as Record<string, unknown>;
    for (const key of ["tags", "Tags", "tag", "tagList", "tag_list"]) {
      if (p[key] !== undefined) candidates.push(p[key]);
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const cand of candidates) {
    for (const t of collect(cand)) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

function pickEmail(c: SwipeOneSearchContact): string {
  if (typeof c.email === "string" && c.email) return c.email;
  if (typeof c.email_address === "string" && c.email_address) return c.email_address;
  const props = c.properties;
  if (props && typeof props === "object") {
    const e = (props as Record<string, unknown>).email;
    if (typeof e === "string" && e) return e;
  }
  return "";
}

function pickFullName(c: SwipeOneSearchContact): string | null {
  const direct =
    (typeof c.fullName === "string" && c.fullName.trim()) ||
    (typeof c.full_name === "string" && c.full_name.trim()) ||
    (typeof c.name === "string" && c.name.trim()) ||
    "";
  if (direct) return direct;
  const first =
    (typeof c.firstName === "string" && c.firstName.trim()) ||
    (typeof c.first_name === "string" && c.first_name.trim()) ||
    "";
  const last =
    (typeof c.lastName === "string" && c.lastName.trim()) ||
    (typeof c.last_name === "string" && c.last_name.trim()) ||
    "";
  const composed = [first, last].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  const props = c.properties;
  if (props && typeof props === "object") {
    const p = props as Record<string, unknown>;
    for (const key of ["fullName", "full_name", "name"]) {
      const v = p[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    const f = p.firstName ?? p.first_name;
    const l = p.lastName ?? p.last_name;
    if (typeof f === "string" || typeof l === "string") {
      const c2 = [
        typeof f === "string" ? f : "",
        typeof l === "string" ? l : "",
      ]
        .join(" ")
        .trim();
      if (c2) return c2;
    }
  }
  return null;
}

async function fetchSwipeOneContactInfo(
  email: string
): Promise<{ fullName: string | null; tags: string[] } | null> {
  try {
    const result = await getSwipeOneContacts(25, email);
    const contacts = (result.contacts || []) as SwipeOneSearchContact[];
    if (contacts.length === 0) return null;
    const exact = contacts.find(
      (c) => pickEmail(c).toLowerCase() === email.toLowerCase()
    );
    const target = exact ?? contacts[0];
    const tags = pickTags(target);
    if (tags.length === 0) {
      // Helpful one-time diagnostic — emit the keys/values seen so we can
      // identify the exact field SwipeOne is using for tags in this workspace.
      try {
        console.warn(
          "[suppressions] SwipeOne contact returned no tags for",
          email,
          "— top-level keys:",
          Object.keys(target),
          "properties keys:",
          target.properties && typeof target.properties === "object"
            ? Object.keys(target.properties)
            : "(none)"
        );
      } catch { /* ignore */ }
    }
    return {
      fullName: pickFullName(target),
      tags,
    };
  } catch (err) {
    console.warn("[suppressions] SwipeOne lookup failed for", email, err);
    return null;
  }
}

interface SuppressionRow {
  email: string;
  name: string | null;
  reasons: string[]; // unsubscribed | complained | bounced
  sources: string[]; // internal | swipeone
  swipeOneTags: string[]; // tags that are actually present on the SwipeOne contact
  contactId: string | null;
  isMarketingAllowed: boolean | null;
  firstSuppressedAt: string;
  lastSuppressedAt: string;
  eventCount: number;
  campaignIds: string[];
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// DEV-ONLY: clear the suppression list. Wipes suppression CampaignEvent rows,
// re-enables marketing on locally-suppressed contacts, and zeroes out the
// matching campaign counters. The route requires super-admin.
export async function DELETE() {
  try {
    await requireSuperAdmin();

    const eventTypes = ["unsubscribed", "complained", "bounced"];

    const eventsResult = await prisma.campaignEvent.deleteMany({
      where: { eventType: { in: eventTypes } },
    });

    // Re-enable marketing for any contact previously suppressed, and strip the
    // suppression-related tags from their tag list so the page goes empty.
    const suppressedContacts = await prisma.contact.findMany({
      where: { isMarketingAllowed: false },
      select: { id: true, tags: true },
    });

    let contactsCleared = 0;
    for (const c of suppressedContacts) {
      let tags: string[] = [];
      try {
        const parsed = JSON.parse(c.tags || "[]");
        if (Array.isArray(parsed)) tags = parsed.map(String);
      } catch { /* ignore */ }
      const filtered = tags.filter(
        (t) => !["unsubscribed", "complained", "bounced", "user.marketing.opted_out"].includes(t)
      );
      await prisma.contact.update({
        where: { id: c.id },
        data: {
          isMarketingAllowed: true,
          emailMarketingConsent: true,
          tags: filtered.length > 0 ? JSON.stringify(filtered) : null,
        },
      });
      contactsCleared += 1;
    }

    // Zero out the per-campaign suppression counters.
    await prisma.campaign.updateMany({
      data: {
        totalUnsubscribed: 0,
        totalBounced: 0,
        totalComplaints: 0,
      },
    });

    // Wipe the SwipeOne tag audit so the page goes truly empty.
    const auditDeleted = await prisma.swipeOneTagAudit.deleteMany({});

    return NextResponse.json({
      success: true,
      eventsDeleted: eventsResult.count,
      contactsCleared,
      auditDeleted: auditDeleted.count,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason"); // unsubscribed | complained | bounced | all
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // 1) Internal Contact rows that have marketing disabled
    const suppressedContacts = await prisma.contact.findMany({
      where: { isMarketingAllowed: false },
      select: {
        id: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // 2) CampaignEvent rows for suppression event types
    const events = await prisma.campaignEvent.findMany({
      where: { eventType: { in: ["unsubscribed", "complained", "bounced"] } },
      select: {
        email: true,
        eventType: true,
        campaignId: true,
        metadata: true,
        createdAt: true,
        campaign: { select: { audienceSource: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const map = new Map<string, SuppressionRow>();

    function ensure(email: string): SuppressionRow {
      let row = map.get(email);
      if (!row) {
        row = {
          email,
          name: null,
          reasons: [],
          sources: [],
          swipeOneTags: [],
          contactId: null,
          isMarketingAllowed: null,
          firstSuppressedAt: new Date().toISOString(),
          lastSuppressedAt: new Date(0).toISOString(),
          eventCount: 0,
          campaignIds: [],
        };
        map.set(email, row);
      }
      return row;
    }

    for (const c of suppressedContacts) {
      const row = ensure(c.email);
      const display =
        c.fullName ||
        [c.firstName, c.lastName].filter(Boolean).join(" ") ||
        null;
      row.name = display;
      row.contactId = c.id;
      row.isMarketingAllowed = false;
      if (!row.sources.includes("internal")) row.sources.push("internal");
      const tags = parseTags(c.tags);
      for (const t of ["unsubscribed", "complained", "bounced"] as const) {
        if (tags.includes(t) && !row.reasons.includes(t)) row.reasons.push(t);
      }
      // If the contact is marketing-disabled but we have no specific reason tag,
      // surface it as an unsubscribed entry by default.
      if (row.reasons.length === 0) row.reasons.push("unsubscribed");
      const created = c.createdAt.toISOString();
      const updated = c.updatedAt.toISOString();
      if (created < row.firstSuppressedAt) row.firstSuppressedAt = created;
      if (updated > row.lastSuppressedAt) row.lastSuppressedAt = updated;
    }

    for (const e of events) {
      // For bounces, only count permanent/hard bounces — transient send failures
      // shouldn't appear on the compliance suppression list.
      if (e.eventType === "bounced") {
        let permanent = false;
        try {
          const meta = JSON.parse(e.metadata || "{}");
          if (meta.bounceType === "Permanent" || meta.bounceSubType) permanent = true;
        } catch { /* ignore */ }
        if (!permanent) continue;
      }

      const row = ensure(e.email);
      if (!row.reasons.includes(e.eventType)) row.reasons.push(e.eventType);
      const sourceLabel = e.campaign?.audienceSource === "swipeone" ? "swipeone" : "internal";
      if (!row.sources.includes(sourceLabel)) row.sources.push(sourceLabel);
      row.eventCount += 1;
      if (!row.campaignIds.includes(e.campaignId)) row.campaignIds.push(e.campaignId);
      const ts = e.createdAt.toISOString();
      if (ts < row.firstSuppressedAt) row.firstSuppressedAt = ts;
      if (ts > row.lastSuppressedAt) row.lastSuppressedAt = ts;
    }

    let suppressions = Array.from(map.values());

    if (reason && reason !== "all") {
      suppressions = suppressions.filter((s) => s.reasons.includes(reason));
    }

    if (search) {
      suppressions = suppressions.filter(
        (s) =>
          s.email.toLowerCase().includes(search) ||
          (s.name || "").toLowerCase().includes(search)
      );
    }

    // Sort by most recently suppressed first
    suppressions.sort((a, b) => (a.lastSuppressedAt < b.lastSuppressedAt ? 1 : -1));

    // Enrich SwipeOne-source rows. Two sources of truth:
    //  1) Audit table (SwipeOneTagAudit) — what we successfully pushed
    //  2) Live SwipeOne contact lookup — what's currently on the record
    // We union both so the column shows everything we know is on the contact.
    // Capped at 200 live lookups for latency; audit is read in one query.
    const swipeOneRows = suppressions
      .filter((s) => s.sources.includes("swipeone"));
    const liveRows = swipeOneRows.slice(0, 200);

    const auditRows = await prisma.swipeOneTagAudit.findMany({
      where: { email: { in: swipeOneRows.map((r) => r.email) } },
    });
    const auditByEmail = new Map<string, string[]>();
    for (const a of auditRows) {
      try {
        const parsed = JSON.parse(a.tags);
        if (Array.isArray(parsed)) auditByEmail.set(a.email, parsed.map(String));
      } catch { /* ignore */ }
    }

    // Backfill: any swipeone-source row without an audit entry gets one
    // populated from the event reasons we already know about. This makes the
    // column reflect existing data without requiring a re-tag.
    for (const row of swipeOneRows) {
      if (auditByEmail.has(row.email)) continue;
      const inferred = Array.from(new Set([...row.reasons, "user.marketing.opted_out"]));
      auditByEmail.set(row.email, inferred);
      try {
        await prisma.swipeOneTagAudit.upsert({
          where: { email: row.email },
          create: {
            email: row.email,
            tags: JSON.stringify(inferred),
            lastReason: row.reasons[0] || null,
          },
          update: {},
        });
      } catch { /* best-effort */ }
    }

    const SUPPRESSION_TAG_FILTER = new Set([
      "unsubscribed",
      "complained",
      "bounced",
      "user.marketing.opted_out",
    ]);

    await Promise.all(
      liveRows.map(async (row) => {
        const info = await fetchSwipeOneContactInfo(row.email);
        if (info?.fullName) row.name = info.fullName;
        const liveTags = info?.tags ?? [];
        const audited = auditByEmail.get(row.email) ?? [];
        const merged = Array.from(new Set([...audited, ...liveTags]));
        row.swipeOneTags = merged.filter((t) => SUPPRESSION_TAG_FILTER.has(t));
      })
    );

    // Rows beyond the live-lookup cap still get audit-only tags
    for (const row of swipeOneRows.slice(200)) {
      const audited = auditByEmail.get(row.email) ?? [];
      row.swipeOneTags = audited.filter((t) => SUPPRESSION_TAG_FILTER.has(t));
    }

    return NextResponse.json({
      suppressions,
      total: suppressions.length,
      counts: {
        unsubscribed: suppressions.filter((s) => s.reasons.includes("unsubscribed")).length,
        complained: suppressions.filter((s) => s.reasons.includes("complained")).length,
        bounced: suppressions.filter((s) => s.reasons.includes("bounced")).length,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
