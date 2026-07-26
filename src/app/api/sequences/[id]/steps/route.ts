import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// POST: append a new step. stepNumber is auto-assigned as (max existing + 1),
// so it always starts at 1 and stays contiguous.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const sequenceId = parseId((await params).id);
    if (sequenceId === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const exists = await prisma.emailSequence.findUnique({ where: { id: sequenceId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));

    const last = await prisma.emailSequenceStep.findFirst({
      where: { sequenceId },
      orderBy: { stepNumber: "desc" },
      select: { stepNumber: true },
    });
    const startAt = (last?.stepNumber ?? 0) + 1;

    // Bulk create: body.steps = [{ name, eventType, subject, htmlContent }, ...]
    if (Array.isArray(body.steps)) {
      const incoming = body.steps as Array<Record<string, unknown>>;
      const created = await prisma.$transaction(
        incoming.map((s, i) =>
          prisma.emailSequenceStep.create({
            data: {
              sequenceId,
              stepNumber: startAt + i,
              name: typeof s.name === "string" && s.name.trim() ? s.name.trim() : `Email ${startAt + i}`,
              eventType: typeof s.eventType === "string" && s.eventType.trim() ? s.eventType.trim() : null,
              subject: typeof s.subject === "string" ? s.subject : "",
              htmlContent: typeof s.htmlContent === "string" ? s.htmlContent : "",
            },
          })
        )
      );
      return NextResponse.json({ steps: created }, { status: 201 });
    }

    const step = await prisma.emailSequenceStep.create({
      data: {
        sequenceId,
        stepNumber: startAt,
        name: body.name?.trim() || `Email ${startAt}`,
        eventType: typeof body.eventType === "string" && body.eventType.trim() ? body.eventType.trim() : null,
        subject: body.subject?.trim() || "",
        htmlContent: typeof body.htmlContent === "string" ? body.htmlContent : "",
        aiPrompt: body.aiPrompt?.trim() || null,
      },
    });

    return NextResponse.json({ step }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: remove ALL steps of a sequence.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const sequenceId = parseId((await params).id);
    if (sequenceId === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const result = await prisma.emailSequenceStep.deleteMany({ where: { sequenceId } });
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    return handleError(error);
  }
}
