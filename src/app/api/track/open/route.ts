import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("c");
  const email = searchParams.get("e");

  if (campaignId && email) {
    try {
      // Check if already recorded to avoid duplicates
      const existing = await prisma.campaignEvent.findFirst({
        where: { campaignId, email, eventType: "opened" },
      });

      if (!existing) {
        await prisma.campaignEvent.create({
          data: { campaignId, email, eventType: "opened", metadata: JSON.stringify({ timestamp: new Date().toISOString() }) },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { totalOpened: { increment: 1 } },
        });
      }
    } catch {
      // Tracking should never break the user experience
    }
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
