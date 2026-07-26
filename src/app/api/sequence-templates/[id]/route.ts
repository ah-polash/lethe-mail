import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const template = await prisma.sequenceTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ template });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await prisma.sequenceTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    if (session.role !== "super_admin" && existing.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.sequenceTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
