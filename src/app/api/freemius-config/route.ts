import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listProducts } from "@/lib/freemius";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: List all Freemius configs
export async function GET() {
  try {
    await requireSuperAdmin();
    const configs = await prisma.freemiusConfig.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ configs });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create a new Freemius config
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const { name, developerId, publicKey, secretKey } = await request.json();

    if (!developerId || !publicKey || !secretKey) {
      return NextResponse.json(
        { error: "Developer ID, Public Key, and Secret Key are required" },
        { status: 400 }
      );
    }

    const existingCount = await prisma.freemiusConfig.count();
    const config = await prisma.freemiusConfig.create({
      data: {
        name: name || "Default",
        developerId: String(developerId).trim(),
        publicKey: String(publicKey).trim(),
        secretKey: String(secretKey).trim(),
        isActive: existingCount === 0,
      },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// PUT: Test the active Freemius connection by listing products
export async function PUT() {
  try {
    await requireSuperAdmin();
    const active = await prisma.freemiusConfig.findFirst({ where: { isActive: true } });
    if (!active) {
      return NextResponse.json({ error: "No active Freemius configuration found" }, { status: 400 });
    }

    const products = await listProducts({
      developerId: active.developerId,
      publicKey: active.publicKey,
      secretKey: active.secretKey,
    });

    return NextResponse.json({
      success: true,
      message: `Freemius connection verified — ${products.length} product(s) found`,
      count: products.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    if (message === "Unauthorized" || message === "Forbidden") return handleError(error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
