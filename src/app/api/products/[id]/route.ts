import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// PUT: Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { name, logoUrl, wpOrgSlug, landingPageUrl, pricingPageUrl } = await request.json();

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Product name cannot be empty" }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl?.trim() || null }),
        ...(wpOrgSlug !== undefined && { wpOrgSlug: wpOrgSlug?.trim() || null }),
        ...(landingPageUrl !== undefined && { landingPageUrl: landingPageUrl?.trim() || null }),
        ...(pricingPageUrl !== undefined && { pricingPageUrl: pricingPageUrl?.trim() || null }),
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Delete product
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
