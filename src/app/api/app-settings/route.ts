import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: Fetch a single setting by ?key=, or all settings if no key is provided.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const key = request.nextUrl.searchParams.get("key");
    if (key) {
      const row = await prisma.appSetting.findUnique({ where: { key } });
      return NextResponse.json({ setting: row, value: row?.value ?? "" });
    }
    const rows = await prisma.appSetting.findMany();
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return NextResponse.json({ settings });
  } catch (error) {
    return handleError(error);
  }
}

// PUT: Upsert a setting. Body: { key: string, value: string }
export async function PUT(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const value = typeof body?.value === "string" ? body.value : "";
    if (!key) return NextResponse.json({ error: "Setting key is required" }, { status: 400 });

    const setting = await prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return NextResponse.json({ setting });
  } catch (error) {
    return handleError(error);
  }
}
