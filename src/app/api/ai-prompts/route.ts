import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: List saved AI prompts for the current user, optionally filtered by aiMode
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const aiMode = request.nextUrl.searchParams.get("aiMode");

    const prompts = await prisma.aiPrompt.findMany({
      where: {
        createdBy: session.id,
        ...(aiMode && { aiMode }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
