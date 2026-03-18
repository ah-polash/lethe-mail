import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: List all AI configs
export async function GET() {
  try {
    await requireSuperAdmin();
    const configs = await prisma.aiConfig.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ configs });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create new AI config
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { name, provider, apiKey, model, baseUrl } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const existingCount = await prisma.aiConfig.count();

    const config = await prisma.aiConfig.create({
      data: {
        name: name || "Default",
        provider: provider || "openrouter",
        apiKey,
        model: model || "google/gemini-2.0-flash-001",
        baseUrl: baseUrl || "https://openrouter.ai/api/v1",
        isActive: existingCount === 0,
      },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// PUT: Test active AI connection
export async function PUT() {
  try {
    await requireSuperAdmin();

    const active = await prisma.aiConfig.findFirst({ where: { isActive: true } });
    if (!active) {
      return NextResponse.json({ error: "No active AI configuration found" }, { status: 400 });
    }

    const response = await fetch(`${active.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${active.apiKey}`,
      },
      body: JSON.stringify({
        model: active.model,
        messages: [{ role: "user", content: "Say hello in one word." }],
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true, message: "AI connection verified successfully" });
    } else {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: data.error?.message || `API returned ${response.status}` },
        { status: 400 }
      );
    }
  } catch (error) {
    return handleError(error);
  }
}
