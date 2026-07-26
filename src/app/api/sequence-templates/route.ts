import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: list sequence-generated templates. Optional ?sequenceId=<n> filter.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const sequenceId = Number(searchParams.get("sequenceId"));

    const where = Number.isInteger(sequenceId) && sequenceId > 0 ? { sequenceId } : {};

    const templates = await prisma.sequenceTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ templates });
  } catch (error) {
    return handleError(error);
  }
}

// POST: create a sequence template (called by "Generate all email steps").
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const htmlContent = typeof body.htmlContent === "string" ? body.htmlContent : "";
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!htmlContent.trim()) return NextResponse.json({ error: "htmlContent is required" }, { status: 400 });

    const template = await prisma.sequenceTemplate.create({
      data: {
        name,
        subject: typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null,
        htmlContent,
        sequenceId: Number.isInteger(body.sequenceId) ? body.sequenceId : null,
        sequenceName: typeof body.sequenceName === "string" ? body.sequenceName : null,
        stepNumber: Number.isInteger(body.stepNumber) ? body.stepNumber : null,
        productName: typeof body.productName === "string" ? body.productName : null,
        createdBy: session.id,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
