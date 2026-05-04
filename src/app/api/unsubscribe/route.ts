import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markContactAsUnsubscribed } from "@/lib/swipeone";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const campaignId = searchParams.get("campaignId");

    if (!email || !campaignId) {
      return NextResponse.json(
        { error: "Email and campaignId are required" },
        { status: 400 }
      );
    }

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if already unsubscribed for this campaign to prevent duplicate events
    const existing = await prisma.campaignEvent.findFirst({
      where: { campaignId, email, eventType: "unsubscribed" },
    });

    if (!existing) {
      // Create unsubscribed event
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          email,
          eventType: "unsubscribed",
          metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
        },
      });

      // Update campaign counter
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          totalUnsubscribed: { increment: 1 },
        },
      });
    }

    // Update the correct system based on audience source
    if (campaign.audienceSource === "swipeone") {
      // SwipeOne audience → only update SwipeOne
      try {
        await markContactAsUnsubscribed(email);
      } catch {
        // SwipeOne integration is best-effort
      }
    } else {
      // Internal audience → update local Contact: set flags + add unsubscribed/opted_out tags
      const contact = await prisma.contact.findUnique({ where: { email } });
      const wantedTags = ["unsubscribed", "user.marketing.opted_out"];
      if (contact) {
        let tags: string[] = [];
        try { tags = JSON.parse(contact.tags || "[]"); } catch { /* ignore */ }
        for (const t of wantedTags) {
          if (!tags.includes(t)) tags.push(t);
        }
        await prisma.contact.update({
          where: { email },
          data: {
            isMarketingAllowed: false,
            emailMarketingConsent: false,
            tags: JSON.stringify(tags),
          },
        });
      } else {
        // Contact doesn't exist yet — create with opted-out state
        await prisma.contact.create({
          data: {
            email,
            isMarketingAllowed: false,
            emailMarketingConsent: false,
            tags: JSON.stringify(wantedTags),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "You have been successfully unsubscribed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
