import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSegmentContacts } from "@/lib/swipeone";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get("segmentId");
    const full = searchParams.get("full") === "1";

    if (!segmentId) {
      return NextResponse.json(
        { error: "segmentId is required" },
        { status: 400 }
      );
    }

    const contacts = await getSegmentContacts(segmentId);

    if (full) {
      return NextResponse.json({
        contacts: contacts as unknown as Record<string, unknown>[],
        count: contacts.length,
      });
    }

    return NextResponse.json({
      contacts: contacts.map((c) => ({
        id: c._id,
        email: c.email,
        name: c.fullName,
      })),
      count: contacts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
