import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: List dynamic templates. Optional filters: ?aiMode=true|product-update&source=manual|ai
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const aiMode = searchParams.get("aiMode");
    const source = searchParams.get("source");

    const where: { aiMode?: string; source?: string } = {};
    if (aiMode) where.aiMode = aiMode;
    if (source) where.source = source;

    const templates = await prisma.dynamicTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ templates });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a new dynamic template (manual save or AI auto-save)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const htmlContent = typeof body.htmlContent === "string" ? body.htmlContent : "";

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!htmlContent.trim()) {
      return NextResponse.json({ error: "htmlContent is required" }, { status: 400 });
    }

    const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
    const source = body.source === "ai" ? "ai" : "manual";
    const aiMode = typeof body.aiMode === "string" && body.aiMode ? body.aiMode : null;
    const prompt = typeof body.prompt === "string" && body.prompt ? body.prompt : null;

    const template = await prisma.dynamicTemplate.create({
      data: {
        name,
        subject,
        htmlContent,
        source,
        aiMode,
        prompt,
        createdBy: session.id,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
