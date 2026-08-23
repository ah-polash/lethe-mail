import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePublicUrl } from "@/lib/r2";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// GET: List all R2 configs
export async function GET() {
  try {
    await requireSuperAdmin();
    const configs = await prisma.r2Config.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ configs });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create new R2 config
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { name, accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = await request.json();

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      return NextResponse.json(
        { error: "Account ID, Access Key, Secret Key, Bucket Name, and Public URL are required" },
        { status: 400 }
      );
    }

    const existingCount = await prisma.r2Config.count();

    const config = await prisma.r2Config.create({
      data: {
        name: name || "Default",
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl: normalizePublicUrl(publicUrl), // scheme added, trailing slash stripped
        isActive: existingCount === 0,
      },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// PUT: Test active R2 connection
export async function PUT() {
  try {
    await requireSuperAdmin();

    const active = await prisma.r2Config.findFirst({ where: { isActive: true } });
    if (!active) {
      return NextResponse.json({ error: "No active R2 configuration found" }, { status: 400 });
    }

    // Test by listing bucket (HeadBucket)
    const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${active.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: active.accessKeyId,
        secretAccessKey: active.secretAccessKey,
      },
    });

    await s3.send(new HeadBucketCommand({ Bucket: active.bucketName }));
    return NextResponse.json({ success: true, message: "R2 connection verified successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    if (message === "Unauthorized" || message === "Forbidden") return handleError(error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
