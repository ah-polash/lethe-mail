import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: ["brand.name", "brand.slogan", "brand.logoUrl", "brand.website"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return NextResponse.json({
      name: map["brand.name"] || "",
      slogan: map["brand.slogan"] || "",
      logoUrl: map["brand.logoUrl"] || "",
      website: map["brand.website"] || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
