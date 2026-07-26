import { NextRequest, NextResponse } from "next/server";
import { getSession, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        creator: { select: { name: true } },
        events: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (session.role !== "super_admin" && campaign.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Count events by type. For headline-metric event types (delivered /
    // opened / clicked / bounced / complained / unsubscribed) we count
    // DISTINCT emails — repeat opens, repeat clicks, redundant SNS
    // notifications, and historical double-writes from earlier code paths
    // would otherwise inflate the rates above 100%. For "sent" / "failed" we
    // still count raw events (each represents a distinct send attempt).
    const UNIQUE_RECIPIENT_TYPES = new Set([
      "delivered",
      "opened",
      "clicked",
      "bounced",
      "complained",
      "unsubscribed",
    ]);
    const eventCounts: Record<string, number> = {};
    const seenPerType = new Map<string, Set<string>>();
    for (const event of campaign.events) {
      if (UNIQUE_RECIPIENT_TYPES.has(event.eventType)) {
        let seen = seenPerType.get(event.eventType);
        if (!seen) {
          seen = new Set();
          seenPerType.set(event.eventType, seen);
        }
        if (!seen.has(event.email)) {
          seen.add(event.email);
          eventCounts[event.eventType] = (eventCounts[event.eventType] || 0) + 1;
        }
      } else {
        eventCounts[event.eventType] = (eventCounts[event.eventType] || 0) + 1;
      }
    }

    // Include failed/bounced/complained events with full details for the log
    const failedEvents = campaign.events
      .filter((e) => ["failed", "bounced", "complained"].includes(e.eventType))
      .map((e) => ({
        id: e.id,
        email: e.email,
        eventType: e.eventType,
        metadata: e.metadata,
        createdAt: e.createdAt,
      }));

    // Unsubscribe activity from the preference center. Each event's metadata
    // captures whether the user picked "all" or a specific set of categories.
    // Resolve category ids → slugs/names so the report can render them.
    const rawUnsubEvents = campaign.events
      .filter((e) => e.eventType === "unsubscribed")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const referencedCategoryIds = new Set<string>();
    type ParsedUnsub = {
      id: string;
      email: string;
      createdAt: Date;
      scope: "all" | "categories";
      categoryIds: string[];
    };
    const parsed: ParsedUnsub[] = rawUnsubEvents.map((e) => {
      let scope: "all" | "categories" = "all";
      let categoryIds: string[] = [];
      try {
        const meta = JSON.parse(e.metadata || "{}");
        if (meta?.scope === "categories") {
          scope = "categories";
          if (Array.isArray(meta.categoryIds)) {
            categoryIds = meta.categoryIds.filter(
              (x: unknown): x is string => typeof x === "string"
            );
            for (const cid of categoryIds) referencedCategoryIds.add(cid);
          }
        } else if (meta?.scope === "all") {
          scope = "all";
        }
      } catch { /* ignore — treat as "all" */ }
      return {
        id: e.id,
        email: e.email,
        createdAt: e.createdAt,
        scope,
        categoryIds,
      };
    });

    let categoryById = new Map<string, { id: string; slug: string; name: string }>();
    if (referencedCategoryIds.size > 0) {
      const cats = await prisma.campaignCategory.findMany({
        where: { id: { in: Array.from(referencedCategoryIds) } },
        select: { id: true, slug: true, name: true },
      });
      categoryById = new Map(cats.map((c) => [c.id, c]));
    }

    const unsubscribeEvents = parsed.map((p) => ({
      id: p.id,
      email: p.email,
      createdAt: p.createdAt,
      scope: p.scope,
      categories: p.categoryIds
        .map((cid) => categoryById.get(cid))
        .filter((c): c is { id: string; slug: string; name: string } => !!c),
    }));

    const unsubscribeSummary = {
      total: unsubscribeEvents.length,
      all: unsubscribeEvents.filter((e) => e.scope === "all").length,
      categories: unsubscribeEvents.filter((e) => e.scope === "categories").length,
      // Counts how many events touched each category slug (one event can hit many).
      perCategory: (() => {
        const counts: Record<string, { slug: string; name: string; count: number }> = {};
        for (const e of unsubscribeEvents) {
          for (const c of e.categories) {
            const cur = counts[c.id] ?? { slug: c.slug, name: c.name, count: 0 };
            cur.count += 1;
            counts[c.id] = cur;
          }
        }
        return Object.values(counts).sort((a, b) => b.count - a.count);
      })(),
    };

    const { events: _, ...campaignData } = campaign;
    return NextResponse.json({
      campaign: {
        ...campaignData,
        eventCounts,
        failedEvents,
        unsubscribeEvents,
        unsubscribeSummary,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft campaigns can be edited" },
        { status: 400 }
      );
    }

    if (session.role !== "super_admin" && campaign.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, subject, fromEmail, fromName, htmlContent, templateId, recipientEmails, segmentIds, segmentNames, audienceSource, categoryId, reviewNote } = body;

    const emails: string[] | undefined = recipientEmails;

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(subject !== undefined && { subject }),
        ...(fromEmail !== undefined && { fromEmail }),
        ...(fromName !== undefined && { fromName }),
        ...(htmlContent !== undefined && { htmlContent }),
        ...(templateId !== undefined && { templateId }),
        ...(emails !== undefined && {
          recipientEmails: JSON.stringify(emails),
          totalRecipients: emails.length,
        }),
        ...(segmentIds !== undefined && {
          segmentIds: JSON.stringify(segmentIds),
        }),
        ...(segmentNames !== undefined && {
          segmentNames: JSON.stringify(segmentNames),
        }),
        ...(audienceSource !== undefined && { audienceSource }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(reviewNote !== undefined && {
          reviewNote:
            typeof reviewNote === "string" && reviewNote.trim()
              ? reviewNote.trim().slice(0, 5000)
              : null,
        }),
      },
    });

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Dev/test: any campaign can be deleted (will be tightened later).
    if (session.role !== "super_admin" && campaign.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.campaignEvent.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
