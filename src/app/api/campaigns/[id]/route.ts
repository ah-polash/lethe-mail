import { NextRequest, NextResponse } from "next/server";
import { getSession, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        creator: { select: { name: true } },
        events: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (session.role !== "super_admin" && campaign.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Count events by type
    const eventCounts: Record<string, number> = {};
    for (const event of campaign.events) {
      eventCounts[event.eventType] = (eventCounts[event.eventType] || 0) + 1;
    }

    const { events: _, ...campaignData } = campaign;
    return NextResponse.json({ campaign: { ...campaignData, eventCounts } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft campaigns can be edited" },
        { status: 400 }
      );
    }

    if (session.role !== "super_admin" && campaign.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, subject, fromEmail, fromName, htmlContent, templateId, recipientEmails, segmentIds, segmentNames, audienceSource } = body;

    const emails: string[] | undefined = recipientEmails;

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(subject !== undefined && { subject }),
        ...(fromEmail !== undefined && { fromEmail }),
        ...(fromName !== undefined && { fromName }),
        ...(htmlContent !== undefined && { htmlContent }),
        ...(templateId !== undefined && { templateId }),
        ...(emails !== undefined && {
          recipientEmails: JSON.stringify(emails),
          totalRecipients: emails.length,
        }),
        ...(segmentIds !== undefined && {
          segmentIds: JSON.stringify(segmentIds),
        }),
        ...(segmentNames !== undefined && {
          segmentNames: JSON.stringify(segmentNames),
        }),
        ...(audienceSource !== undefined && { audienceSource }),
      },
    });

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft campaigns can be deleted" },
        { status: 400 }
      );
    }

    if (session.role !== "super_admin" && campaign.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.campaignEvent.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
