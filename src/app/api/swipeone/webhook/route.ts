import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { addTagToContact } from "@/lib/swipeone";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { email, tag } = await request.json();

    if (!email || !tag) {
      return NextResponse.json(
        { error: "email and tag are required" },
        { status: 400 }
      );
    }

    const result = await addTagToContact(email, tag);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
