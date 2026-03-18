import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendBulkEmails } from "@/lib/ses";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireSuperAdmin();

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return NextResponse.json(
        { error: "Campaign has already been sent or is currently sending" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { scheduledAt } = body;

    // Schedule for later
    if (scheduledAt) {
      const updated = await prisma.campaign.update({
        where: { id },
        data: {
          status: "scheduled",
          scheduledAt: new Date(scheduledAt),
        },
      });
      return NextResponse.json({ campaign: updated });
    }

    // Get recipient emails from campaign
    const recipientEmails: string[] = campaign.recipientEmails
      ? JSON.parse(campaign.recipientEmails)
      : [];

    if (recipientEmails.length === 0) {
      return NextResponse.json(
        { error: "No recipients found for this campaign" },
        { status: 400 }
      );
    }

    if (!campaign.fromEmail) {
      return NextResponse.json(
        { error: "No sender email set for this campaign" },
        { status: 400 }
      );
    }

    // Set status to sending (totalRecipients updated after suppression filtering below)
    await prisma.campaign.update({
      where: { id },
      data: { status: "sending" },
    });

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Look up contact data for all recipients
    const contacts = await prisma.contact.findMany({
      where: { email: { in: recipientEmails } },
    });

    const contactByEmail = new Map<string, Record<string, unknown>>();
    const suppressedEmails = new Set<string>();

    for (const contact of contacts) {
      const { properties, ...rest } = contact as unknown as Record<string, unknown>;
      let parsed: Record<string, unknown> = {};
      if (typeof properties === "string" && properties) {
        try { parsed = JSON.parse(properties); } catch { /* ignore */ }
      }
      contactByEmail.set(contact.email, { ...rest, ...parsed });

      // Suppress contacts who unsubscribed or have marketing disallowed
      if (!contact.isMarketingAllowed) {
        suppressedEmails.add(contact.email);
      }
    }

    // Also check for any previously bounced (hard) or complained emails across all campaigns
    const suppressedEvents = await prisma.campaignEvent.findMany({
      where: {
        email: { in: recipientEmails },
        eventType: { in: ["bounced", "complained", "unsubscribed"] },
      },
      select: { email: true, eventType: true, metadata: true },
    });

    for (const event of suppressedEvents) {
      if (event.eventType === "complained" || event.eventType === "unsubscribed") {
        suppressedEmails.add(event.email);
      }
      // Only suppress permanent/hard bounces, not transient send failures
      if (event.eventType === "bounced") {
        try {
          const meta = JSON.parse(event.metadata || "{}");
          if (meta.bounceType === "Permanent" || meta.bounceSubType) {
            suppressedEmails.add(event.email);
          }
        } catch { /* ignore */ }
      }
    }

    // Filter out suppressed recipients
    const eligibleEmails = recipientEmails.filter((e) => !suppressedEmails.has(e));
    const skippedCount = recipientEmails.length - eligibleEmails.length;

    if (eligibleEmails.length === 0) {
      await prisma.campaign.update({
        where: { id },
        data: { status: "sent", sentAt: new Date(), totalSent: 0, totalRecipients: recipientEmails.length },
      });
      return NextResponse.json({
        error: `All ${recipientEmails.length} recipient(s) are suppressed (unsubscribed, bounced, or complained). No emails sent.`,
        skipped: skippedCount,
      }, { status: 422 });
    }

    // Replace {{propertyName}} merge tags with actual contact values
    function resolveMergeTags(template: string, contactData: Record<string, unknown>): string {
      return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
        const value = contactData[key];
        if (value === null || value === undefined || value === "") return "";
        if (typeof value === "object") {
          try { return JSON.stringify(value); } catch { return ""; }
        }
        return String(value);
      });
    }

    const emails = eligibleEmails.map((email) => {
      const contactData = contactByEmail.get(email) || { email };
      return {
        to: email,
        subject: resolveMergeTags(campaign.subject, contactData),
        htmlBody: resolveMergeTags(campaign.htmlContent, contactData),
        fromEmail: campaign.fromEmail,
        fromName: campaign.fromName,
        unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}&campaignId=${id}`,
      };
    });

    const result = await sendBulkEmails(emails, id);

    // If all emails failed, mark campaign as failed with error details
    if (result.sent === 0 && result.failed > 0) {
      const updated = await prisma.campaign.update({
        where: { id },
        data: {
          totalSent: 0,
          status: "failed",
        },
      });
      return NextResponse.json({
        campaign: updated,
        result: {
          sent: result.sent,
          failed: result.failed,
          errors: result.errors,
        },
        error: `All emails failed to send. ${result.errors[0] || ""}`,
      }, { status: 422 });
    }

    // Update campaign with results
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        totalRecipients: recipientEmails.length,
        totalSent: result.sent,
        status: "sent",
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      campaign: updated,
      result: {
        sent: result.sent,
        failed: result.failed,
        skipped: skippedCount,
        errors: result.errors,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    // Mark campaign as failed on error
    try {
      await prisma.campaign.update({
        where: { id },
        data: { status: "failed" },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
