import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  markContactAsUnsubscribed,
  markContactAsComplained,
  markContactAsBounced,
} from "@/lib/swipeone";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle SNS subscription confirmation
    if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
      await fetch(body.SubscribeURL);
      return NextResponse.json({ success: true, message: "Subscription confirmed" });
    }

    // Handle SNS notification
    let message = body;
    if (body.Type === "Notification" && body.Message) {
      message = JSON.parse(body.Message);
    }

    const eventType = message.eventType || message.notificationType;
    if (!eventType) {
      return NextResponse.json({ success: true, message: "No event type found" });
    }

    // Extract details based on event type
    let email = "";
    let messageId = "";
    let metadata: Record<string, unknown> = {};

    switch (eventType) {
      case "Bounce": {
        const bounce = message.bounce;
        messageId = message.mail?.messageId || "";
        email = bounce?.bouncedRecipients?.[0]?.emailAddress || "";
        metadata = {
          bounceType: bounce?.bounceType,
          bounceSubType: bounce?.bounceSubType,
          messageId,
        };
        break;
      }
      case "Complaint": {
        const complaint = message.complaint;
        messageId = message.mail?.messageId || "";
        email = complaint?.complainedRecipients?.[0]?.emailAddress || "";
        metadata = {
          complaintFeedbackType: complaint?.complaintFeedbackType,
          messageId,
        };
        break;
      }
      case "Delivery": {
        const delivery = message.delivery;
        messageId = message.mail?.messageId || "";
        email = delivery?.recipients?.[0] || message.mail?.destination?.[0] || "";
        metadata = {
          processingTimeMillis: delivery?.processingTimeMillis,
          smtpResponse: delivery?.smtpResponse,
          messageId,
        };
        break;
      }
      case "Open": {
        const open = message.open;
        messageId = message.mail?.messageId || "";
        email = message.mail?.destination?.[0] || "";
        metadata = {
          ipAddress: open?.ipAddress,
          userAgent: open?.userAgent,
          messageId,
        };
        break;
      }
      case "Click": {
        const click = message.click;
        messageId = message.mail?.messageId || "";
        email = message.mail?.destination?.[0] || "";
        metadata = {
          link: click?.link,
          ipAddress: click?.ipAddress,
          userAgent: click?.userAgent,
          messageId,
        };
        break;
      }
      default:
        return NextResponse.json({ success: true, message: `Unhandled event type: ${eventType}` });
    }

    if (!messageId) {
      return NextResponse.json({ success: true, message: "No messageId found" });
    }

    // Find the campaign by looking for the sent event with this messageId
    const sentEvent = await prisma.campaignEvent.findFirst({
      where: {
        eventType: "sent",
        metadata: { contains: messageId },
      },
    });

    if (!sentEvent) {
      return NextResponse.json({ success: true, message: "No matching campaign found" });
    }

    const campaignId = sentEvent.campaignId;

    // Map SES event types to our event types
    const eventTypeMap: Record<string, string> = {
      Bounce: "bounced",
      Complaint: "complained",
      Delivery: "delivered",
      Open: "opened",
      Click: "clicked",
    };

    const mappedEventType = eventTypeMap[eventType];

    // Create event record
    await prisma.campaignEvent.create({
      data: {
        campaignId,
        email,
        eventType: mappedEventType,
        metadata: JSON.stringify(metadata),
      },
    });

    // Update campaign counters
    const counterMap: Record<string, string> = {
      delivered: "totalDelivered",
      opened: "totalOpened",
      clicked: "totalClicked",
      bounced: "totalBounced",
      complained: "totalComplaints",
    };

    const counterField = counterMap[mappedEventType];
    if (counterField) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          [counterField]: { increment: 1 },
        },
      });
    }

    // Look up campaign to determine audience source
    const campaignRecord = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { audienceSource: true },
    });
    const source = campaignRecord?.audienceSource || "internal";

    // Helper to update an internal contact: set suppression flags + add tags.
    async function suppressInternalContact(
      contactEmail: string,
      setConsent: boolean,
      extraTags: string[] = []
    ) {
      const contact = await prisma.contact.findUnique({ where: { email: contactEmail } });
      if (contact) {
        let tags: string[] = [];
        try { tags = JSON.parse(contact.tags || "[]"); } catch { /* ignore */ }
        for (const t of [...extraTags, "user.marketing.opted_out"]) {
          if (!tags.includes(t)) tags.push(t);
        }
        await prisma.contact.update({
          where: { email: contactEmail },
          data: {
            isMarketingAllowed: false,
            ...(setConsent && { emailMarketingConsent: false }),
            tags: JSON.stringify(tags),
          },
        });
      }
    }

    // For hard bounces, suppress future sends to this address
    if (eventType === "Bounce" && email) {
      const bounceType = (metadata as Record<string, unknown>).bounceType;
      if (bounceType === "Permanent") {
        if (source === "swipeone") {
          try { await markContactAsBounced(email); } catch { /* best-effort */ }
        } else {
          await suppressInternalContact(email, false, ["bounced"]);
        }
      }
    }

    // For complaints, tag and suppress the contact in the correct system
    if (eventType === "Complaint" && email) {
      if (source === "swipeone") {
        try { await markContactAsComplained(email); } catch { /* best-effort */ }
      } else {
        await suppressInternalContact(email, true, ["complained"]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
