import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/ses";
import { prisma } from "@/lib/db";

const SIMULATOR_CAMPAIGN_NAME = "[SES Simulator] System Test Campaign";

// Get-or-create a synthetic campaign that holds the "sent" events fired from
// the simulator panel. The webhook needs a matching "sent" CampaignEvent to
// correlate inbound bounce/complaint events to a campaign — without it the
// inbound event is silently dropped.
async function ensureSimulatorCampaign(createdBy: string): Promise<string> {
  const existing = await prisma.campaign.findFirst({
    where: { name: SIMULATOR_CAMPAIGN_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.campaign.create({
    data: {
      name: SIMULATOR_CAMPAIGN_NAME,
      subject: "(SES simulator)",
      htmlContent: "<p>Simulator test</p>",
      audienceSource: "internal",
      status: "sent",
      createdBy,
    },
    select: { id: true },
  });
  return created.id;
}

const SIMULATOR_TARGETS = {
  success: "success@simulator.amazonses.com",
  bounce: "bounce@simulator.amazonses.com",
  ooto: "ooto@simulator.amazonses.com",
  complaint: "complaint@simulator.amazonses.com",
  suppressionlist: "suppressionlist@simulator.amazonses.com",
  reject: "reject@simulator.amazonses.com",
} as const;

type SimulatorKey = keyof typeof SIMULATOR_TARGETS;

const SIMULATOR_LABEL: Record<SimulatorKey, string> = {
  success: "Successful delivery",
  bounce: "Hard bounce (Permanent)",
  ooto: "Soft bounce (Out-of-office)",
  complaint: "Complaint (spam report)",
  suppressionlist: "SES suppression-list bounce",
  reject: "Rejected (virus/malware)",
};

// POST /api/dev/ses-simulator — fire a real send to one of the SES mailbox
// simulator addresses. Super-admin only. Sandbox limits don't apply to
// simulator addresses, so this works even without production-access SES.
export async function POST(request: NextRequest) {
  try {
    const session = await requireSuperAdmin();

    const body = await request.json();
    const simulator = body.simulator as SimulatorKey | undefined;
    const fromEmail = typeof body.fromEmail === "string" ? body.fromEmail.trim() : "";
    const fromName = typeof body.fromName === "string" ? body.fromName.trim() : "";

    if (!simulator || !(simulator in SIMULATOR_TARGETS)) {
      return NextResponse.json(
        { error: "simulator must be one of: " + Object.keys(SIMULATOR_TARGETS).join(", ") },
        { status: 400 }
      );
    }
    if (!fromEmail) {
      return NextResponse.json({ error: "fromEmail is required" }, { status: 400 });
    }

    const target = SIMULATOR_TARGETS[simulator];
    const label = SIMULATOR_LABEL[simulator];
    const subject = `[SES Simulator] ${label}`;
    const htmlBody = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;">
<h2>SES Simulator Test</h2>
<p>This message was sent to <code>${target}</code> to trigger a synthetic
<strong>${label}</strong> event.</p>
<p>Sent at: ${new Date().toISOString()}</p>
</body></html>`;

    const campaignId = await ensureSimulatorCampaign(session.id);

    const result = await sendEmail({
      to: [target],
      subject,
      htmlBody,
      fromEmail,
      fromName,
      campaignId,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Record a "sent" event so the SES webhook can correlate the resulting
    // bounce/complaint to this campaign — exactly what real campaign sends do.
    if (result.messageId) {
      try {
        await prisma.campaignEvent.create({
          data: {
            campaignId,
            email: target,
            eventType: "sent",
            metadata: JSON.stringify({
              messageId: result.messageId,
              source: "simulator",
              simulator,
            }),
          },
        });
      } catch (err) {
        console.warn("[ses-simulator] failed to record sent event:", err);
      }
    }

    return NextResponse.json({
      success: true,
      simulator,
      target,
      label,
      messageId: result.messageId,
      campaignId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
