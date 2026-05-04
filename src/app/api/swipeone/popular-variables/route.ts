import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    await requireAuth();
    const variables = await prisma.popularVariable.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ variables });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    const name = rawName.replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "");
    const label = typeof body.label === "string" ? body.label.trim() : null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!/^[\w.]+$/.test(name)) {
      return NextResponse.json(
        { error: "Variable name can only contain letters, numbers, _ or ." },
        { status: 400 }
      );
    }

    // Pick a sortOrder one greater than the current max so new entries land at the bottom.
    const last = await prisma.popularVariable.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (last?.sortOrder ?? 0) + 1;

    const variable = await prisma.popularVariable.upsert({
      where: { name },
      create: { name, label, sortOrder },
      update: { label },
    });

    return NextResponse.json({ variable }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
