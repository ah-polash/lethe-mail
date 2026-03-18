import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSegments } from "@/lib/swipeone";

export async function GET() {
  try {
    await requireAuth();

    const segments = await getSegments();

    return NextResponse.json({ segments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
