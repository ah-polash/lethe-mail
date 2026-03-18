import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifySesConnection, resetSesClient } from "@/lib/ses";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: List all SES configs
export async function GET() {
  try {
    await requireSuperAdmin();

    const configs = await prisma.sesConfig.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create new SES config
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { name, region, accessKeyId, secretAccessKey, configSetName } =
      await request.json();

    if (!region || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: "Region, accessKeyId, and secretAccessKey are required" },
        { status: 400 }
      );
    }

    // If this is the first config, make it active
    const existingCount = await prisma.sesConfig.count();

    const config = await prisma.sesConfig.create({
      data: {
        name: name || "Default",
        region,
        accessKeyId,
        secretAccessKey,
        configSetName: configSetName || null,
        isActive: existingCount === 0,
      },
    });

    if (config.isActive) resetSesClient();

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// PUT: Test active connection
export async function PUT() {
  try {
    await requireSuperAdmin();

    const result = await verifySesConnection();

    if (result.success) {
      return NextResponse.json({ success: true, message: "SES connection verified successfully" });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (error) {
    return handleError(error);
  }
}
