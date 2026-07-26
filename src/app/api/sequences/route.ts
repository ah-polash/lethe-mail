import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: list all sequences with step + send counts
export async function GET() {
  try {
    await requireAuth();
    const sequences = await prisma.emailSequence.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { steps: true, sends: true } },
      },
    });
    return NextResponse.json({ sequences });
  } catch (error) {
    return handleError(error);
  }
}

// POST: create a new sequence
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const { name, description, fromEmail, fromName } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const sequence = await prisma.emailSequence.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        fromEmail: fromEmail?.trim() || "",
        fromName: fromName?.trim() || "bPlugins",
        createdBy: user.id,
      },
    });

    return NextResponse.json({ sequence }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
