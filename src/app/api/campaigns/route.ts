import { NextRequest, NextResponse } from "next/server";
import { getSession, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where = session.role === "super_admin" ? {} : { createdBy: session.id };

    // Explicit field list: `recipientEmails` caches the resolved audience and can
    // be tens of MB for a large segment — never ship it in the list response.
    const campaigns = await prisma.campaign.findMany({
      where,
      select: {
        id: true, name: true, subject: true, fromEmail: true, fromName: true,
        status: true, scheduledAt: true, sentAt: true,
        totalRecipients: true, totalSent: true, totalDelivered: true,
        totalOpened: true, totalClicked: true, totalBounced: true,
        totalComplaints: true, totalUnsubscribed: true,
        audienceSource: true, segmentNames: true, categoryId: true,
        reviewNote: true, templateId: true,
        createdBy: true, createdAt: true, updatedAt: true,
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { name, subject, fromEmail, fromName, htmlContent, templateId, recipientEmails, segmentIds, segmentNames, audienceSource, categoryId, reviewNote } = body;

    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "Name, subject, and htmlContent are required" },
        { status: 400 }
      );
    }

    const emails: string[] = recipientEmails || [];

    const campaign = await prisma.campaign.create({
      data: {
        name,
        subject,
        fromEmail: fromEmail || "",
        fromName: fromName || "",
        htmlContent,
        templateId: templateId || null,
        recipientEmails: emails.length > 0 ? JSON.stringify(emails) : null,
        totalRecipients: emails.length,
        segmentIds: segmentIds ? JSON.stringify(segmentIds) : null,
        segmentNames: segmentNames ? JSON.stringify(segmentNames) : null,
        audienceSource: audienceSource || "internal",
        categoryId: categoryId || null,
        reviewNote:
          typeof reviewNote === "string" && reviewNote.trim() ? reviewNote.trim().slice(0, 5000) : null,
        status: "draft",
        createdBy: session.id,
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
