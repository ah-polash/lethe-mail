import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/campaigns/[id]/duplicate
// Creates a new draft campaign copying every editable field from the source.
// Counters, send timestamps, and the campaign status are NOT copied — the new
// campaign starts as a fresh draft.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const source = await prisma.campaign.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (session.role !== "super_admin" && source.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newName = `Copy of ${source.name}`.slice(0, 200);

    const duplicate = await prisma.campaign.create({
      data: {
        name: newName,
        subject: source.subject,
        fromEmail: source.fromEmail,
        fromName: source.fromName,
        htmlContent: source.htmlContent,
        templateId: source.templateId,
        recipientEmails: source.recipientEmails,
        segmentIds: source.segmentIds,
        segmentNames: source.segmentNames,
        audienceSource: source.audienceSource,
        categoryId: source.categoryId,
        // Counters left at zero (Prisma defaults)
        status: "draft",
        createdBy: session.id,
        // totalRecipients: keep 0 here; the editor / send pipeline will
        // recompute when needed. For SwipeOne campaigns recipients are
        // resolved at send time anyway.
      },
    });

    return NextResponse.json({ campaign: duplicate }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
