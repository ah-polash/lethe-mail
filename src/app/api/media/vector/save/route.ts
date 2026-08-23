import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { sanitizeSvg, SVG_DIMENSIONS } from "@/lib/media-svg";
import { encodeFrames, OUTPUT_FORMATS, type OutputFormat } from "@/lib/media-animate";

export const maxDuration = 120;

// Frames arrive from the browser, so they are treated as untrusted input even
// though this server drew them: re-sanitised, count-limited and size-capped
// before anything is handed to the rasteriser.
const MAX_FRAMES = 8;
const MAX_FRAME_BYTES = 512_000;

// POST: encode an already-designed set of keyframes into the chosen format and
// store it in the media library. The same design can be saved more than once —
// a still for Outlook and a GIF for everyone else, say.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => ({}));

    const format = (OUTPUT_FORMATS.find((f) => f.key === body.format)?.key || "png") as OutputFormat;
    const spec = OUTPUT_FORMATS.find((f) => f.key === format)!;

    const incoming: unknown[] = Array.isArray(body.frames) ? body.frames : [];
    const frames = incoming
      .filter((f): f is string => typeof f === "string" && f.includes("<svg"))
      .slice(0, MAX_FRAMES)
      .map(sanitizeSvg);

    if (frames.length === 0) {
      return NextResponse.json({ error: "Nothing to save — generate the artwork first." }, { status: 400 });
    }
    if (frames.some((f) => f.length > MAX_FRAME_BYTES)) {
      return NextResponse.json({ error: "That artwork is too large to encode." }, { status: 400 });
    }
    if (spec.animated && frames.length < 2) {
      return NextResponse.json(
        { error: `This design is a single still, so it cannot be saved as ${spec.label}. Generate again with more than one frame.` },
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

    // Width comes from the shape catalogue, never straight from the request, so
    // a stray number cannot ask for a gigapixel render.
    const dims = SVG_DIMENSIONS[typeof body.aspect === "string" ? body.aspect : "banner"] || SVG_DIMENSIONS.banner;

    let encoded;
    try {
      encoded = encodeFrames(frames, format, dims.width);
    } catch (e) {
      return NextResponse.json(
        { error: `The artwork could not be encoded: ${e instanceof Error ? e.message : "unknown error"}` },
        { status: 400 }
      );
    }

    const title = (typeof body.title === "string" && body.title.trim() ? body.title : "email illustration").slice(0, 80);
    const altText = (typeof body.altText === "string" ? body.altText : title).slice(0, 300);
    const emailText = typeof body.emailText === "string" ? body.emailText : "";

    const slug =
      title.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) ||
      "email-illustration";
    const key = `media/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${encoded.extension}`;

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
        Body: encoded.buffer,
        ContentType: encoded.mimeType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const asset = await prisma.mediaAsset.create({
      data: {
        name: `${slug}.${encoded.extension}`,
        key,
        url: `${r2.publicUrl.replace(/\/+$/, "")}/${key}`,
        mimeType: encoded.mimeType,
        size: encoded.buffer.length,
        // The model's own description — meaningful alt text rather than the raw prompt.
        altText,
        source: "ai",
        // Store the email that inspired it, trimmed, so the origin is traceable.
        aiPrompt: emailText ? `From email copy: ${emailText.slice(0, 500)}` : null,
        aiModel: typeof body.engine === "string" ? body.engine.slice(0, 100) : "local Claude CLI (vector)",
        createdBy: session.id,
      },
    });

    return NextResponse.json({
      asset,
      format,
      label: spec.label,
      frameCount: encoded.frameCount,
      size: encoded.buffer.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the artwork";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
