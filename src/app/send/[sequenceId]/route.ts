import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dispatchSequenceEvent, tokensMatch } from "@/lib/sequence";

// Event-driven sequence webhook. Point ONE URL at this per sequence:
//
//   POST /send/{sequenceId}?token=SEQUENCE_TOKEN
//   body: the full provider payload, e.g. { "type": "license.activated", ... }
//
// It reads the event name from the payload (the sequence's eventField, default
// "type") and fires every step whose eventType matches — so you don't have to
// address a specific step number. Use /send/{sequenceId}/{stepNumber} when you
// want to fire an exact step instead.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  const sequenceId = Number((await params).sequenceId);
  if (!Number.isInteger(sequenceId) || sequenceId <= 0) {
    return NextResponse.json({ error: "Invalid sequence id" }, { status: 400 });
  }

  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    select: { webhookToken: true },
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
    const dispatch = await dispatchSequenceEvent(sequenceId, payload);
    // 200 even when no step matches — a non-matching event is a valid no-op, not
    // an error (the plugin fires many event types; only some map to a step).
    return NextResponse.json({ ok: true, ...dispatch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    if (message === "sequence_paused") {
      return NextResponse.json({ error: "Sequence is paused" }, { status: 409 });
    }
    if (message === "event_not_found") {
      return NextResponse.json(
        { error: "No event name found at the configured event field for this sequence" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
