import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

interface CategoryPill {
  id: string;          // CategoryUnsubscribe row id (for per-pill deletion if needed)
  categoryId: string;
  slug: string;
  name: string;
}

interface UnsubscriberRow {
  id: string;          // synthetic, of the form `email:<email>`
  email: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  categories: CategoryPill[];
  hasGlobal: boolean;
  latestAt: string;
  latestCampaignName: string | null;
}

// GET /api/unsubscribers
//   ?categoryId=<id>  filter to emails who opted out of this category
//   ?categoryId=all   filter to emails with a global unsubscribe
//   ?search=<text>    search by email
//   ?limit=&offset=   pagination
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get("categoryId"); // null | "all" | <uuid>
    const search = (searchParams.get("search") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const wantAll = categoryFilter === "all";
    const wantCategory = !!(categoryFilter && categoryFilter !== "all");

    // 1) Determine the set of emails this query is about.
    let baseEmails = new Set<string>();

    if (wantCategory) {
      const rows = await prisma.categoryUnsubscribe.findMany({
        where: { categoryId: categoryFilter as string },
        select: { email: true },
      });
      for (const r of rows) baseEmails.add(r.email);
    } else if (wantAll) {
      const events = await prisma.campaignEvent.findMany({
        where: { eventType: "unsubscribed" },
        select: { email: true, metadata: true },
      });
      for (const e of events) {
        let scope: string | undefined;
        try {
          const meta = JSON.parse(e.metadata || "{}");
          scope = typeof meta?.scope === "string" ? meta.scope : undefined;
        } catch { /* ignore */ }
        if (scope === "all") baseEmails.add(e.email);
      }
    } else {
      const cats = await prisma.categoryUnsubscribe.findMany({
        select: { email: true },
      });
      for (const r of cats) baseEmails.add(r.email);

      const events = await prisma.campaignEvent.findMany({
        where: { eventType: "unsubscribed" },
        select: { email: true, metadata: true },
      });
      for (const e of events) {
        let scope: string | undefined;
        try {
          const meta = JSON.parse(e.metadata || "{}");
          scope = typeof meta?.scope === "string" ? meta.scope : undefined;
        } catch { /* ignore */ }
        if (scope === "all") baseEmails.add(e.email);
      }
    }

    // 2) Apply email search.
    if (search) {
      const needle = search.toLowerCase();
      baseEmails = new Set(
        [...baseEmails].filter((e) => e.toLowerCase().includes(needle))
      );
    }

    if (baseEmails.size === 0) {
      return NextResponse.json({ unsubscribers: [], count: 0 });
    }

    const emailList = [...baseEmails];

    // 3) Fetch every category opt-out for these emails (so we can show the
    //    full pill list per row, not just the filtered one).
    const allCategoryRows = await prisma.categoryUnsubscribe.findMany({
      where: { email: { in: emailList } },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });

    // 4) Fetch every "unsubscribed" campaign event so we can compute hasGlobal
    //    and the most recent activity.
    const allEvents = await prisma.campaignEvent.findMany({
      where: { email: { in: emailList }, eventType: "unsubscribed" },
      orderBy: { createdAt: "desc" },
      select: {
        email: true,
        createdAt: true,
        metadata: true,
        campaign: { select: { id: true, name: true } },
      },
    });

    // 5) Group everything by email.
    const byEmail = new Map<string, UnsubscriberRow>();
    for (const e of emailList) {
      byEmail.set(e, {
        id: `email:${e}`,
        email: e,
        categories: [],
        hasGlobal: false,
        latestAt: "",
        latestCampaignName: null,
      });
    }

    for (const cat of allCategoryRows) {
      const row = byEmail.get(cat.email);
      if (!row) continue;
      row.categories.push({
        id: cat.id,
        categoryId: cat.category.id,
        slug: cat.category.slug,
        name: cat.category.name,
      });
      const iso = cat.createdAt.toISOString();
      if (iso > row.latestAt) row.latestAt = iso;
    }

    for (const ev of allEvents) {
      const row = byEmail.get(ev.email);
      if (!row) continue;
      let scope: string | undefined;
      try {
        const meta = JSON.parse(ev.metadata || "{}");
        scope = typeof meta?.scope === "string" ? meta.scope : undefined;
      } catch { /* ignore */ }
      if (scope === "all") row.hasGlobal = true;
      const iso = ev.createdAt.toISOString();
      if (iso > row.latestAt) {
        row.latestAt = iso;
        row.latestCampaignName = ev.campaign?.name ?? null;
      }
    }

    // 6) Hydrate name fields from local Contact when available.
    const contacts = await prisma.contact.findMany({
      where: { email: { in: emailList } },
      select: { email: true, firstName: true, lastName: true, fullName: true },
    });
    const contactByEmail = new Map(contacts.map((c) => [c.email, c]));
    for (const row of byEmail.values()) {
      const c = contactByEmail.get(row.email);
      if (c) {
        row.firstName = c.firstName;
        row.lastName = c.lastName;
        row.fullName = c.fullName;
      }
    }

    const combined = [...byEmail.values()].sort((a, b) =>
      b.latestAt.localeCompare(a.latestAt)
    );

    return NextResponse.json({
      unsubscribers: combined.slice(offset, offset + limit),
      count: combined.length,
    });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/unsubscribers
//   ?id=<categoryUnsubscribeId>     Delete one CategoryUnsubscribe row.
//   ?email=<email>&scope=all        Delete this email's global unsubscribed
//                                   campaign events (keeps any per-category
//                                   opt-outs).
//   ?email=<email>                  Clear all unsubscribe state for one email.
//   no params                       Clear everything (test/dev).
export async function DELETE(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    const email = searchParams.get("email")?.trim();
    const scope = searchParams.get("scope")?.trim();

    if (id) {
      try {
        await prisma.categoryUnsubscribe.delete({ where: { id } });
      } catch {
        return NextResponse.json({ error: "Unsubscribe entry not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, scope: "row", id });
    }

    if (email && scope === "all") {
      const b = await prisma.campaignEvent.deleteMany({
        where: { email, eventType: "unsubscribed" },
      });
      return NextResponse.json({
        success: true,
        scope: "global",
        email,
        unsubscribedEvents: b.count,
      });
    }

    if (email) {
      const a = await prisma.categoryUnsubscribe.deleteMany({ where: { email } });
      const b = await prisma.campaignEvent.deleteMany({
        where: { email, eventType: "unsubscribed" },
      });
      return NextResponse.json({
        success: true,
        scope: "email",
        email,
        categoryRows: a.count,
        unsubscribedEvents: b.count,
      });
    }

    const a = await prisma.categoryUnsubscribe.deleteMany({});
    const b = await prisma.campaignEvent.deleteMany({ where: { eventType: "unsubscribed" } });
    return NextResponse.json({
      success: true,
      scope: "all",
      categoryRows: a.count,
      unsubscribedEvents: b.count,
    });
  } catch (error) {
    return handleError(error);
  }
}
