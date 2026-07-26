import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/ses";
import { getByPath, resolveMergeTags } from "@/lib/merge";

export { getByPath, resolveMergeTags };

export function getBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

// The public webhook URL for firing one step of a sequence. External systems
// POST the contact payload here to send that step's email.
export function stepWebhookUrl(sequenceId: number, stepNumber: number, token: string): string {
  return `${getBaseUrl()}/send/${sequenceId}/${stepNumber}?token=${token}`;
}

// Resolve the recipient email from a (possibly nested) payload using the
// sequence's configured emailField dot-path, e.g. "objects.user.email".
export function resolveEmail(payload: Record<string, unknown>, emailField: string): string {
  const raw = getByPath(payload, emailField || "email");
  return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
}

// Returns true if the email must NOT be sent: globally unsubscribed, complained,
// or hard-bounced. Reuses the same CampaignEvent signals the campaign sender uses.
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const events = await prisma.campaignEvent.findMany({
    where: {
      email,
      eventType: { in: ["unsubscribed", "complained", "bounced"] },
    },
    select: { eventType: true, metadata: true },
  });

  for (const ev of events) {
    if (ev.eventType === "complained") return true;
    if (ev.eventType === "unsubscribed") {
      // Global unsubscribe (no specific category) suppresses everything.
      let categoryId: unknown = undefined;
      try {
        categoryId = ev.metadata ? JSON.parse(ev.metadata)?.categoryId : undefined;
      } catch {
        /* treat as global */
      }
      if (!categoryId) return true;
    }
    if (ev.eventType === "bounced") {
      let bounceType: unknown = undefined;
      try {
        bounceType = ev.metadata ? JSON.parse(ev.metadata)?.bounceType : undefined;
      } catch {
        /* ignore */
      }
      if (bounceType === "Permanent" || bounceType === undefined) return true;
    }
  }
  return false;
}

export interface FireStepResult {
  status: "sent" | "suppressed" | "failed";
  messageId?: string;
  error?: string;
}

// Renders step {stepNumber} of {sequenceId} for the given contact payload and
// sends it. Records a SequenceSendLog row. `payload` must contain `email`.
export async function fireSequenceStep(
  sequenceId: number,
  stepNumber: number,
  payload: Record<string, unknown>
): Promise<FireStepResult> {
  const step = await prisma.emailSequenceStep.findUnique({
    where: { sequenceId_stepNumber: { sequenceId, stepNumber } },
    include: { sequence: true },
  });
  if (!step) throw new Error("step_not_found");
  if (step.sequence.status !== "active") throw new Error("sequence_paused");

  const email = resolveEmail(payload, step.sequence.emailField);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("email_not_found");
  }

  async function log(result: FireStepResult) {
    await prisma.sequenceSendLog.create({
      data: {
        sequenceId,
        stepNumber,
        email,
        status: result.status,
        messageId: result.messageId,
        error: result.error,
      },
    });
    return result;
  }

  if (await isEmailSuppressed(email)) {
    return log({ status: "suppressed", error: "recipient suppressed" });
  }

  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;

  const subject = resolveMergeTags(step.subject, payload);
  const htmlBody = resolveMergeTags(step.htmlContent, payload);
  const fromName = resolveMergeTags(step.sequence.fromName || "bPlugins", payload).trim() || "bPlugins";

  const result = await sendEmail({
    to: [email],
    subject,
    htmlBody,
    fromEmail: step.sequence.fromEmail,
    fromName,
    unsubscribeUrl,
  });

  if (result.error) {
    return log({ status: "failed", error: result.error });
  }
  return log({ status: "sent", messageId: result.messageId });
}

export interface DispatchResult {
  event: string;
  matched: number[]; // stepNumbers that matched the event
  results: Array<{ stepNumber: number } & FireStepResult>;
}

// Event-driven fire: read the event name from the payload (sequence.eventField,
// e.g. Freemius "type") and fire every step whose eventType matches. Used by the
// sequence-level webhook so one URL auto-selects the right step(s).
export async function dispatchSequenceEvent(
  sequenceId: number,
  payload: Record<string, unknown>
): Promise<DispatchResult> {
  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (!sequence) throw new Error("sequence_not_found");
  if (sequence.status !== "active") throw new Error("sequence_paused");

  const raw = getByPath(payload, sequence.eventField || "type");
  const event = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!event) throw new Error("event_not_found");

  const matches = sequence.steps.filter((s) => (s.eventType || "").trim() === event);

  const results: Array<{ stepNumber: number } & FireStepResult> = [];
  for (const step of matches) {
    try {
      const r = await fireSequenceStep(sequenceId, step.stepNumber, payload);
      results.push({ stepNumber: step.stepNumber, ...r });
    } catch (e) {
      results.push({
        stepNumber: step.stepNumber,
        status: "failed",
        error: e instanceof Error ? e.message : "error",
      });
    }
  }

  return { event, matched: matches.map((s) => s.stepNumber), results };
}
