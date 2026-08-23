import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publicAssetUrl } from "@/lib/r2";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// Types worth hosting for email use. Images are what actually render in an
// email client; the rest are for linking (a PDF guide, a demo video).
const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf", "video/mp4", "video/webm",
]);
const MAX_BYTES = 25 * 1024 * 1024;

// GET: list media, newest first. ?q= filters by name, ?type=image filters kind.
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const type = searchParams.get("type") || "";

    const assets = await prisma.mediaAsset.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(type === "image" ? { mimeType: { startsWith: "image/" } } : {}),
        ...(type === "other" ? { NOT: { mimeType: { startsWith: "image/" } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { creator: { select: { name: true } } },
    });
    return NextResponse.json({ assets });
  } catch (error) {
    return handleError(error);
  }
}

// POST: upload a file to R2 and record it in the library.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const r2 = await prisma.r2Config.findFirst({ where: { isActive: true } });
    if (!r2) {
      return NextResponse.json(
        { error: "No R2 storage configured. Set it up in Settings → Cloudflare R2." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type "${file.type || "unknown"}"` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be under 25MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = (file.name || "file").replace(/[^\w.\-]+/g, "-").slice(0, 80);
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
    const key = `media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        // Long cache: keys are unique per upload, so content never changes.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const asset = await prisma.mediaAsset.create({
      data: {
        name: safeName,
        key,
        url: publicAssetUrl(r2.publicUrl, key),
        mimeType: file.type,
        size: file.size,
        createdBy: session.id,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
