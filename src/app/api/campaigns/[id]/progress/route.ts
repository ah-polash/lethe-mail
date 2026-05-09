import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAuth();

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, status: true, totalRecipients: true, totalSent: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const [sent, failed] = await Promise.all([
      prisma.campaignEvent.count({
        where: { campaignId: id, eventType: "sent" },
      }),
      prisma.campaignEvent.count({
        where: { campaignId: id, eventType: "failed" },
      }),
    ]);

    return NextResponse.json({
      status: campaign.status,
      total: campaign.totalRecipients,
      sent,
      failed,
      processed: sent + failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
