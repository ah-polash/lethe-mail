import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listVerifiedIdentities } from "@/lib/ses";

// GET: List verified SES identities (emails and domains) for the active
// connection, plus that connection's defaultFromEmail (if set) so the campaign
// editor can preselect it.
export async function GET() {
  try {
    await requireAuth();

    const result = await listVerifiedIdentities();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const active = await prisma.sesConfig.findFirst({ where: { isActive: true } });

    return NextResponse.json({
      identities: result.identities,
      defaultFromEmail: active?.defaultFromEmail || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
