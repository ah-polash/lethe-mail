import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

const STATUSES = ["waiting_initial_review", "reviewed", "under_development", "fixed_shipped"];

// PATCH: change status (super admin only).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.feedbackReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const report = await prisma.feedbackReport.update({
      where: { id },
      data: { status: body.status },
    });
    return NextResponse.json({ report });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: super admin, or the reporter deleting their own submission.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await prisma.feedbackReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    if (session.role !== "super_admin" && existing.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.feedbackReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
