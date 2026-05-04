import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET /api/webhook-logs?campaignId=&messageId=&includeUnmatched=1
// Returns the most recent webhook POSTs we received. Used by the campaign log
// viewer so we can verify SNS data is being received correctly — including
// payloads that didn't match a campaign or that produced an error.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const messageId = searchParams.get("messageId");
    const includeUnmatched = searchParams.get("includeUnmatched") === "1";

    type WebhookLogWhere = {
      campaignId?: string | null;
      messageId?: string;
      OR?: { campaignId?: string | null }[];
    };
    const where: WebhookLogWhere = {};

    if (campaignId) {
      // When asking by campaignId, optionally include unmatched/orphan payloads
      // (no campaignId yet) so the user can inspect events that *should* have
      // matched but didn't (e.g. bad messageId correlation).
      if (includeUnmatched) {
        where.OR = [{ campaignId }, { campaignId: null }];
      } else {
        where.campaignId = campaignId;
      }
    }
    if (messageId) where.messageId = messageId;

    const logs = await prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ logs, count: logs.length });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/webhook-logs?olderThan=days
// Dev-only cleanup so the table doesn't grow forever. No `olderThan` → wipes all.
export async function DELETE(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const { searchParams } = new URL(request.url);
    const olderThan = searchParams.get("olderThan");
    if (olderThan) {
      const days = parseInt(olderThan, 10);
      if (!Number.isFinite(days) || days < 0) {
        return NextResponse.json({ error: "olderThan must be a non-negative integer" }, { status: 400 });
      }
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.webhookLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      return NextResponse.json({ deleted: result.count });
    }
    const result = await prisma.webhookLog.deleteMany({});
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    return handleError(error);
  }
}
