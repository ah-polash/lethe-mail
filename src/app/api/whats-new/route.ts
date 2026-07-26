import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: list announcements with per-emoji reaction counts and the current
// user's own reactions.
export async function GET() {
  try {
    const session = await requireAuth();

    const features = await prisma.featureAnnouncement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { reactions: { select: { emoji: true, userId: true } } },
    });

    const shaped = features.map((f) => {
      const counts: Record<string, number> = {};
      const mine: string[] = [];
      for (const r of f.reactions) {
        counts[r.emoji] = (counts[r.emoji] || 0) + 1;
        if (r.userId === session.id) mine.push(r.emoji);
      }
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        createdAt: f.createdAt,
        counts,
        mine,
        totalReactions: f.reactions.length,
      };
    });

    return NextResponse.json({ features: shaped });
  } catch (error) {
    return handleError(error);
  }
}

// POST: create an announcement (super admin only).
export async function POST(request: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = await request.json();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });

    const feature = await prisma.featureAnnouncement.create({
      data: {
        title,
        description,
        status: body.status === "shipped" ? "shipped" : "upcoming",
        createdBy: session.id,
      },
    });

    return NextResponse.json({ feature }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
