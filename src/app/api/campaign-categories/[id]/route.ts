import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// PUT: Update a campaign category. Super admin only.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.campaignCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    // `slug` is intentionally not destructured — it's immutable once a
    // category is created.
    const {
      name,
      description,
      swipeOneTagOverride,
      autoCheckOnUnsubscribe,
    } = await request.json();

    if (name !== undefined && !String(name).trim()) {
      return NextResponse.json({ error: "Category name cannot be empty" }, { status: 400 });
    }

    if (name !== undefined && String(name).trim() !== existing.name) {
      const dup = await prisma.campaignCategory.findUnique({ where: { name: String(name).trim() } });
      if (dup) {
        return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
      }
    }

    const category = await prisma.campaignCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(swipeOneTagOverride !== undefined && {
          swipeOneTagOverride:
            typeof swipeOneTagOverride === "string" && swipeOneTagOverride.trim()
              ? swipeOneTagOverride.trim()
              : null,
        }),
        ...(autoCheckOnUnsubscribe !== undefined && {
          autoCheckOnUnsubscribe: !!autoCheckOnUnsubscribe,
        }),
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Delete a campaign category. Super admin only.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.campaignCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    await prisma.campaignCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
