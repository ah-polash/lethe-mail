import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

function parseInt2(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// PUT: update a step's content (name, subject, html, prompt)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepNumber: string }> }
) {
  try {
    await requireAuth();
    const { id, stepNumber: sn } = await params;
    const sequenceId = parseInt2(id);
    const stepNumber = parseInt2(sn);
    if (sequenceId === null || stepNumber === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.eventType === "string") data.eventType = body.eventType.trim() || null;
    if (typeof body.subject === "string") data.subject = body.subject;
    if (typeof body.htmlContent === "string") data.htmlContent = body.htmlContent;
    if (typeof body.aiPrompt === "string") data.aiPrompt = body.aiPrompt.trim() || null;

    const step = await prisma.emailSequenceStep.update({
      where: { sequenceId_stepNumber: { sequenceId, stepNumber } },
      data,
    });
    return NextResponse.json({ step });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: remove a step, then renumber the ones after it so stepNumbers stay
// contiguous (1..N). This keeps the /send/{id}/{stepNumber} URLs meaningful.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepNumber: string }> }
) {
  try {
    await requireAuth();
    const { id, stepNumber: sn } = await params;
    const sequenceId = parseInt2(id);
    const stepNumber = parseInt2(sn);
    if (sequenceId === null || stepNumber === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.emailSequenceStep.delete({
        where: { sequenceId_stepNumber: { sequenceId, stepNumber } },
      });
      const after = await tx.emailSequenceStep.findMany({
        where: { sequenceId, stepNumber: { gt: stepNumber } },
        orderBy: { stepNumber: "asc" },
        select: { id: true },
      });
      // Shift each subsequent step down by one. Done sequentially to avoid
      // colliding with the @@unique([sequenceId, stepNumber]) constraint.
      let next = stepNumber;
      for (const s of after) {
        await tx.emailSequenceStep.update({ where: { id: s.id }, data: { stepNumber: next } });
        next += 1;
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
