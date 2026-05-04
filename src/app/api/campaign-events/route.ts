import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET /api/campaign-events?email=<email>&campaignId=<id>
// Returns the full event log for the email and/or campaign — used by the
// suppression page's "View campaign log" action so we can verify the SNS
// pipeline (sent → delivered → bounced/complained) end-to-end.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const campaignId = searchParams.get("campaignId");

    if (!email && !campaignId) {
      return NextResponse.json(
        { error: "email or campaignId is required" },
        { status: 400 }
      );
    }

    const events = await prisma.campaignEvent.findMany({
      where: {
        ...(email ? { email } : {}),
        ...(campaignId ? { campaignId } : {}),
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            subject: true,
            audienceSource: true,
            status: true,
            sentAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      events,
      count: events.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
