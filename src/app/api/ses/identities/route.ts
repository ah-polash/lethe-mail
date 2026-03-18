import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listVerifiedIdentities } from "@/lib/ses";

// GET: List verified SES identities (emails and domains)
export async function GET() {
  try {
    await requireAuth();

    const result = await listVerifiedIdentities();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ identities: result.identities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
