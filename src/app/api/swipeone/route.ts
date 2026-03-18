import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: List all SwipeOne configs
export async function GET() {
  try {
    await requireSuperAdmin();

    const configs = await prisma.swipeOneConfig.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create new SwipeOne config
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { name, apiKey, baseUrl, workspaceId } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const normalizedBaseUrl = (baseUrl || "https://api.swipeone.com").replace(/\/+$/, "");

    // If this is the first config, make it active
    const existingCount = await prisma.swipeOneConfig.count();

    const config = await prisma.swipeOneConfig.create({
      data: {
        name: name || "Default",
        apiKey,
        baseUrl: normalizedBaseUrl,
        workspaceId: workspaceId || "",
        isActive: existingCount === 0,
      },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// PUT: Test active connection
export async function PUT() {
  try {
    await requireSuperAdmin();

    const config = await prisma.swipeOneConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return NextResponse.json({ error: "No active SwipeOne configuration" }, { status: 400 });
    }

    const baseUrl = config.baseUrl.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/zapier/fields`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
    });

    if (res.ok) {
      return NextResponse.json({ success: true, message: "SwipeOne connection successful" });
    } else {
      const text = await res.text();
      return NextResponse.json(
        { error: `SwipeOne API returned ${res.status}: ${text}` },
        { status: 400 }
      );
    }
  } catch (error) {
    return handleError(error);
  }
}
