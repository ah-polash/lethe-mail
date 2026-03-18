import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("c");
  const email = searchParams.get("e");
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  if (campaignId && email) {
    try {
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          email,
          eventType: "clicked",
          metadata: JSON.stringify({ link: url, timestamp: new Date().toISOString() }),
        },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { totalClicked: { increment: 1 } },
      });
    } catch {
      // Tracking should never break the user experience
    }
  }

  // Redirect to the actual URL
  return NextResponse.redirect(url, 302);
}
