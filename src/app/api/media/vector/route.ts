import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateVectorFromEmail, isCliImageEngineAvailable, SVG_DIMENSIONS } from "@/lib/media-svg";
import { OUTPUT_FORMATS, type OutputFormat } from "@/lib/media-animate";

export const maxDuration = 300;

// GET: whether this machine can run the vector engine, plus the shapes offered.
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({
      available: isCliImageEngineAvailable(),
      shapes: Object.entries(SVG_DIMENSIONS).map(([key, d]) => ({ key, ...d })),
      formats: OUTPUT_FORMATS.map(({ key, label, animated, note }) => ({ key, label, animated, note })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// POST: read the pasted email copy, design matching artwork, store it in the
// media library with the model's own title and alt text.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => ({}));

    const emailText = typeof body.emailText === "string" ? body.emailText.trim() : "";
    if (!emailText) {
      return NextResponse.json({ error: "Paste the email text first" }, { status: 400 });
    }
    if (emailText.length < 40) {
      return NextResponse.json(
        { error: "That's very short — paste more of the email so the artwork can match it." },
        { status: 400 }
      );
    }

    const r2 = await prisma.r2Config.findFirst({ where: { isActive: true } });
    if (!r2) {
      return NextResponse.json(
        { error: "No R2 storage configured. Set it up in Settings → Cloudflare R2." },
        { status: 400 }
      );
    }

    const cliConfig = await prisma.aiConfig.findFirst({ where: { provider: "claude-cli" } });
    const cliPath = cliConfig?.baseUrl?.startsWith("/") ? cliConfig.baseUrl : null;

    const requestedFormat = OUTPUT_FORMATS.some((f) => f.key === body.format)
      ? (body.format as OutputFormat)
      : "png";

    const art = await generateVectorFromEmail({
      emailText,
      style: typeof body.style === "string" ? body.style : "hero",
      aspect: typeof body.aspect === "string" ? body.aspect : "banner",
      model: cliConfig?.model || undefined,
      cliPath,
      format: requestedFormat,
      frames: Number(body.frames) || undefined,
    });

    const slug =
      art.title.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) ||
      "email-illustration";
    const key = `media/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${art.extension}`;

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
        Body: art.png,
        ContentType: art.mimeType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const asset = await prisma.mediaAsset.create({
      data: {
        name: `${slug}.${art.extension}`,
        key,
        url: `${r2.publicUrl.replace(/\/+$/, "")}/${key}`,
        mimeType: art.mimeType,
        size: art.png.length,
        // The model's own description — meaningful alt text rather than the raw prompt.
        altText: art.altText,
        source: "ai",
        // Store the email that inspired it, trimmed, so the origin is traceable.
        aiPrompt: `From email copy: ${emailText.slice(0, 500)}`,
        aiModel: art.engine,
        createdBy: session.id,
      },
    });

    return NextResponse.json({
      asset,
      title: art.title,
      altText: art.altText,
      dimensions: `${art.width}×${art.height}`,
      format: requestedFormat,
      frameCount: art.frameCount,
      cost: art.costUsd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vector generation failed";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
