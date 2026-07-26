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

// GET: one sequence with its ordered steps
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const id = parseId((await params).id);
    if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const sequence = await prisma.emailSequence.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    });
    if (!sequence) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ sequence });
  } catch (error) {
    return handleError(error);
  }
}

// PUT: update sequence metadata (name, description, sender, status)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const id = parseId((await params).id);
    if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (typeof body.fromEmail === "string") data.fromEmail = body.fromEmail.trim();
    if (typeof body.fromName === "string") data.fromName = body.fromName.trim();
    if (typeof body.emailField === "string") data.emailField = body.emailField.trim() || "email";
    if (typeof body.eventField === "string") data.eventField = body.eventField.trim() || "type";
    if (body.status === "active" || body.status === "paused") data.status = body.status;
    if (
      [
        "freemius_event",
        "lead_nurture",
        "upsell",
        "cross_sell",
        "discount",
        "free_to_paid",
        "win_back",
        "renewal",
        "review_request",
        "gift_from_ceo",
      ].includes(body.sequenceType)
    ) {
      data.sequenceType = body.sequenceType;
    }

    const sequence = await prisma.emailSequence.update({ where: { id }, data });
    return NextResponse.json({ sequence });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: remove a sequence (cascades to steps + send logs)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const id = parseId((await params).id);
    if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await prisma.emailSequence.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
