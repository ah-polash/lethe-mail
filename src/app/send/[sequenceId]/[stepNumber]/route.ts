import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fireSequenceStep, tokensMatch } from "@/lib/sequence";

// Public webhook fired by external systems (e.g. a WordPress plugin).
//
//   POST /send/{sequenceId}/{stepNumber}?token=SEQUENCE_TOKEN
//   body: { "email": "user@example.com", "firstName": "...", ...anyMergeVars }
//
// Renders that step's email for the posted contact payload and sends it.
// Auth is the per-sequence webhook token (query `?token=` or `x-webhook-token`
// header) — no user session, since this is called machine-to-machine.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sequenceId: string; stepNumber: string }> }
) {
  const { sequenceId: rawSeq, stepNumber: rawStep } = await params;
  const sequenceId = Number(rawSeq);
  const stepNumber = Number(rawStep);

  if (!Number.isInteger(sequenceId) || sequenceId <= 0 || !Number.isInteger(stepNumber) || stepNumber <= 0) {
    return NextResponse.json({ error: "Invalid sequence or step id" }, { status: 400 });
  }

  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    select: { webhookToken: true, status: true },
  });

  const token =
    request.nextUrl.searchParams.get("token") || request.headers.get("x-webhook-token") || "";

  // Same 401 whether the sequence is missing or the token is wrong, so an
  // unauthenticated caller can't enumerate which sequence ids exist.
  if (!sequence || !tokensMatch(token, sequence.webhookToken)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  try {
    const result = await fireSequenceStep(sequenceId, stepNumber, payload);
    if (result.status === "failed") {
      return NextResponse.json({ ok: false, ...result }, { status: 502 });
    }
    const httpStatus = result.status === "suppressed" ? 200 : 200;
    return NextResponse.json({ ok: true, ...result }, { status: httpStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "step_not_found") {
      return NextResponse.json({ error: `Step ${stepNumber} not found in sequence ${sequenceId}` }, { status: 404 });
    }
    if (message === "sequence_paused") {
      return NextResponse.json({ error: "Sequence is paused" }, { status: 409 });
    }
    if (message === "email_not_found") {
      return NextResponse.json(
        { error: "No valid recipient email found at the configured email field for this sequence" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
