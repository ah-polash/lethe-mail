import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// PUT: Update SwipeOne config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.swipeOneConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const { name, apiKey, baseUrl, workspaceId } = await request.json();

    const config = await prisma.swipeOneConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(apiKey !== undefined && { apiKey }),
        ...(baseUrl !== undefined && { baseUrl: baseUrl.replace(/\/+$/, "") }),
        ...(workspaceId !== undefined && { workspaceId }),
      },
    });

    return NextResponse.json({ config });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Delete SwipeOne config
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.swipeOneConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (existing.isActive) {
      return NextResponse.json(
        { error: "Cannot delete the active configuration. Set another as active first." },
        { status: 400 }
      );
    }

    await prisma.swipeOneConfig.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

// PATCH: Set as active
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.swipeOneConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Deactivate all, then activate this one
    await prisma.swipeOneConfig.updateMany({ data: { isActive: false } });
    const config = await prisma.swipeOneConfig.update({
      where: { id },
      data: { isActive: true },
    });

    return NextResponse.json({ config });
  } catch (error) {
    return handleError(error);
  }
}
