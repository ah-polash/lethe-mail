import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, resolveNotificationSender } from "@/lib/ses";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// POST: a general user submits a campaign for admin review. Marks the campaign
// `pending_review` and emails every super admin so they can complete the
// audience/details and send it.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Only draft-ish campaigns can be submitted; never re-open a sent one.
    if (!["draft", "pending_review"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Campaign cannot be submitted from status "${campaign.status}"` },
        { status: 400 }
      );
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: "pending_review" },
    });

    // Notify super admins (best-effort — submission still succeeds if mail fails).
    let notified = 0;
    let emailError: string | undefined;
    try {
      const admins = await prisma.user.findMany({
        where: { role: "super_admin" },
        select: { email: true },
      });
      const sender = await resolveNotificationSender();
      const fromEmail = sender.fromEmail;
      const senderError = sender.error;
      const brandSetting = await prisma.appSetting.findUnique({ where: { key: "brand.name" } });
      const brand = brandSetting?.value?.trim() || "bPlugins";
      const baseUrl = (
        process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      ).replace(/\/+$/, "");
      const reviewUrl = `${baseUrl}/campaigns/swipeone/${id}`;

      if (fromEmail && admins.length > 0) {
        const esc = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 8px;font-size:20px;">Campaign submitted for review</h1>
      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">
        <strong>${esc(session.name)}</strong> (${esc(session.email)}) submitted a campaign and is
        waiting for an admin to complete the campaign details, choose SwipeOne segments, and send it.
      </p>
      <div style="background:#f4f4f7;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:14px;"><strong>Campaign:</strong> ${esc(updated.name)}</p>
        <p style="margin:0;font-size:14px;"><strong>Subject:</strong> ${esc(updated.subject || "—")}</p>
      </div>
      ${
        updated.reviewNote
          ? `<div style="border-left:3px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#b45309;">Note from ${esc(session.name)}</p>
        <p style="margin:0;font-size:14px;color:#333;white-space:pre-wrap;">${esc(updated.reviewNote)}</p>
      </div>`
          : ""
      }
      <a href="${reviewUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;">
        Review &amp; send
      </a>
    </div>
  </div>
</body></html>`;

        const result = await sendEmail({
          to: admins.map((a) => a.email),
          subject: `Campaign awaiting review: ${updated.name}`,
          htmlBody: html,
          fromEmail,
          fromName: brand,
        });
        if (result.error) emailError = result.error;
        else notified = admins.length;
      } else {
        emailError = !fromEmail
          ? senderError || "No sender address available for notifications"
          : "No super admin accounts found";
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Notification failed";
    }

    return NextResponse.json({ campaign: updated, notified, emailError });
  } catch (error) {
    return handleError(error);
  }
}
