import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Flatten the properties JSON into the contact object for the frontend
function flattenContact(contact: Record<string, unknown>) {
  const { properties, ...rest } = contact;
  let parsed: Record<string, unknown> = {};
  if (typeof properties === "string" && properties) {
    try {
      parsed = JSON.parse(properties);
    } catch {
      // ignore
    }
  }
  return { ...rest, ...parsed };
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || "25");
    const offset = Number(searchParams.get("offset") || "0");
    const search = searchParams.get("search") || undefined;
    const unsubscribedOnly = searchParams.get("unsubscribed") === "true";

    const conditions: Record<string, unknown>[] = [];

    if (search) {
      conditions.push({
        OR: [
          { email: { contains: search } },
          { fullName: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { tags: { contains: search } },
          { properties: { contains: search } },
        ],
      });
    }

    if (unsubscribedOnly) {
      conditions.push({ isMarketingAllowed: false });
    }

    const subscribersOnly = searchParams.get("subscribers") === "true";
    if (subscribersOnly) {
      conditions.push({ tags: { contains: "user.marketing.opted_in" } });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [contacts, count] = await Promise.all([
      prisma.contact.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts: contacts.map((c) => flattenContact(c as unknown as Record<string, unknown>)),
      count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    const { email, firstName, lastName, ...rest } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existing = await prisma.contact.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Contact with this email already exists" }, { status: 409 });
    }

    const contact = await prisma.contact.create({
      data: {
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: [firstName, lastName].filter(Boolean).join(" ") || null,
        tags: Array.isArray(rest.tags) ? JSON.stringify(rest.tags) : rest.tags || null,
        properties: Object.keys(rest).length > 0 ? JSON.stringify(rest) : null,
      },
    });

    return NextResponse.json({ contact: flattenContact(contact as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
