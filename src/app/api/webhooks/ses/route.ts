import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  markContactAsUnsubscribed,
  markContactAsComplained,
  markContactAsBounced,
} from "@/lib/swipeone";

export async function POST(request: NextRequest) {
  // Capture the raw request body before anything else so we can log it
  // regardless of whether parsing/processing succeeds.
  const rawText = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch {
    // Persist a log row even for malformed JSON, then bail.
    try {
      await prisma.webhookLog.create({
        data: {
          source: "ses-sns",
          status: "error",
          result: "Invalid JSON body",
          raw: rawText.slice(0, 20000),
        },
      });
    } catch { /* best-effort */ }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Stub a log row — we'll patch it with the resolved details below.
  let logId: string | null = null;
  try {
    const stub = await prisma.webhookLog.create({
      data: {
        source: "ses-sns",
        type: typeof body.Type === "string" ? (body.Type as string) : null,
        status: "received",
        raw: rawText.slice(0, 20000),
      },
    });
    logId = stub.id;
  } catch { /* best-effort */ }

  async function patchLog(fields: Partial<{
    type: string | null;
    eventType: string | null;
    messageId: string | null;
    email: string | null;
    campaignId: string | null;
    status: string;
    result: string | null;
  }>) {
    if (!logId) return;
    try {
      await prisma.webhookLog.update({ where: { id: logId }, data: fields });
    } catch { /* best-effort */ }
  }

  try {
    // Handle SNS subscription confirmation
    if (body.Type === "SubscriptionConfirmation" && typeof body.SubscribeURL === "string") {
      await fetch(body.SubscribeURL);
      await patchLog({ status: "confirmed", result: "SNS subscription confirmed" });
      return NextResponse.json({ success: true, message: "Subscription confirmed" });
    }

    // Handle SNS notification — parsed payload uses dynamic SES schemas, so we
    // intentionally type it loosely.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let message: any = body;
    if (body.Type === "Notification" && typeof body.Message === "string") {
      try {
        message = JSON.parse(body.Message);
      } catch {
        await patchLog({ status: "error", result: "Notification.Message was not valid JSON" });
        return NextResponse.json({ error: "Bad SNS notification body" }, { status: 400 });
      }
    }

    const eventType: string | null =
      (typeof message?.eventType === "string" && message.eventType) ||
      (typeof message?.notificationType === "string" && message.notificationType) ||
      null;
    if (!eventType) {
      await patchLog({ status: "unhandled", result: "No event type in payload" });
      return NextResponse.json({ success: true, message: "No event type found" });
    }
    await patchLog({ eventType });

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
        await patchLog({ status: "unhandled", result: `Unhandled event type: ${eventType}` });
        return NextResponse.json({ success: true, message: `Unhandled event type: ${eventType}` });
    }

    await patchLog({ messageId: messageId || null, email: email || null });

    if (!messageId) {
      await patchLog({ status: "error", result: "No messageId in payload" });
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
      await patchLog({
        status: "unmatched",
        result: `No matching campaign for messageId ${messageId}`,
      });
      return NextResponse.json({ success: true, message: "No matching campaign found" });
    }

    const campaignId = sentEvent.campaignId;
    await patchLog({ campaignId });

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

    await patchLog({
      status: "processed",
      result: `Recorded ${eventTypeMap[eventType] || eventType} for ${email || "(unknown)"}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Internal server error";
    await patchLog({ status: "error", result: errMsg.slice(0, 1000) });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
