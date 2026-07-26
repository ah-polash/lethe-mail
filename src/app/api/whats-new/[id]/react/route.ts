import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥"];

// POST: toggle the current user's reaction {emoji} on a feature.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const emoji = typeof body.emoji === "string" ? body.emoji : "";
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    const feature = await prisma.featureAnnouncement.findUnique({ where: { id }, select: { id: true } });
    if (!feature) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = await prisma.featureReaction.findUnique({
      where: { featureId_userId_emoji: { featureId: id, userId: session.id, emoji } },
    });

    if (existing) {
      await prisma.featureReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.featureReaction.create({
        data: { featureId: id, userId: session.id, emoji },
      });
    }

    const count = await prisma.featureReaction.count({ where: { featureId: id, emoji } });
    return NextResponse.json({ reacted: !existing, emoji, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
