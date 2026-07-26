import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: list all reports (any authenticated user can view statuses).
export async function GET() {
  try {
    await requireAuth();
    const reports = await prisma.feedbackReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { creator: { select: { name: true } } },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    return handleError(error);
  }
}

// POST: submit a bug report or feature request.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });

    const report = await prisma.feedbackReport.create({
      data: {
        type: body.type === "feature" ? "feature" : "bug",
        title,
        description,
        screenshotUrl:
          typeof body.screenshotUrl === "string" && body.screenshotUrl.trim()
            ? body.screenshotUrl.trim()
            : null,
        createdBy: session.id,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
