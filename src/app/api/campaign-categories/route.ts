import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET: List all campaign categories. Authenticated users (read access for
// campaign creation forms etc.).
export async function GET() {
  try {
    await requireAuth();
    const categories = await prisma.campaignCategory.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json({ categories });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a new campaign category. Super admin only.
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const {
      name,
      slug,
      description,
      swipeOneTagOverride,
      autoCheckOnUnsubscribe,
    } = await request.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const trimmedName = String(name).trim();
    const existing = await prisma.campaignCategory.findUnique({ where: { name: trimmedName } });
    if (existing) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }

    // Slug: prefer client-provided value (already shown to the user) but
    // always re-slugify and fall back to the name. Slugs are immutable once
    // a category is saved, so we only write this on create.
    const proposedSlug = slugify(typeof slug === "string" && slug ? slug : trimmedName) || "category";
    const slugClash = await prisma.campaignCategory.findUnique({ where: { slug: proposedSlug } });
    if (slugClash) {
      return NextResponse.json(
        { error: `A category with the readable id "${proposedSlug}" already exists` },
        { status: 409 }
      );
    }

    const category = await prisma.campaignCategory.create({
      data: {
        name: trimmedName,
        slug: proposedSlug,
        description: description?.trim() || null,
        swipeOneTagOverride:
          typeof swipeOneTagOverride === "string" && swipeOneTagOverride.trim()
            ? swipeOneTagOverride.trim()
            : null,
        autoCheckOnUnsubscribe: !!autoCheckOnUnsubscribe,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
