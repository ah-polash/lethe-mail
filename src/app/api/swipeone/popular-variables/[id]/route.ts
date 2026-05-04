import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.popularVariable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Variable not found" }, { status: 404 });
    }

    await prisma.popularVariable.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
