import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listVerifiedIdentitiesFor } from "@/lib/ses";

// GET: List verified SES identities for a specific config (by id).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const config = await prisma.sesConfig.findUnique({ where: { id } });
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const result = await listVerifiedIdentitiesFor({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ identities: result.identities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
