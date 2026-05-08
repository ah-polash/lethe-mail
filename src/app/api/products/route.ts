import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: List all products
export async function GET() {
  try {
    await requireSuperAdmin();
    const products = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json({ products });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create new product
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { name, logoUrl, wpOrgSlug, landingPageUrl, pricingPageUrl } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        logoUrl: logoUrl?.trim() || null,
        wpOrgSlug: wpOrgSlug?.trim() || null,
        landingPageUrl: landingPageUrl?.trim() || null,
        pricingPageUrl: pricingPageUrl?.trim() || null,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
