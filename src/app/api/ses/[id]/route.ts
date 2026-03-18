import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resetSesClient } from "@/lib/ses";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// PUT: Update SES config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.sesConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const { name, region, accessKeyId, secretAccessKey, configSetName } =
      await request.json();

    const config = await prisma.sesConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(region !== undefined && { region }),
        ...(accessKeyId !== undefined && { accessKeyId }),
        ...(secretAccessKey !== undefined && { secretAccessKey }),
        ...(configSetName !== undefined && { configSetName: configSetName || null }),
      },
    });

    if (config.isActive) resetSesClient();

    return NextResponse.json({ config });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Delete SES config
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.sesConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (existing.isActive) {
      return NextResponse.json(
        { error: "Cannot delete the active configuration. Set another as active first." },
        { status: 400 }
      );
    }

    await prisma.sesConfig.delete({ where: { id } });

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

    const existing = await prisma.sesConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Deactivate all, then activate this one
    await prisma.sesConfig.updateMany({ data: { isActive: false } });
    const config = await prisma.sesConfig.update({
      where: { id },
      data: { isActive: true },
    });

    resetSesClient();

    return NextResponse.json({ config });
  } catch (error) {
    return handleError(error);
  }
}
