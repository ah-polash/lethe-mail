import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  generateImages, buildImagePrompt, IMAGE_MODELS, STYLE_PRESETS, ASPECTS, ASPECT_RATIOS,
} from "@/lib/media-ai";
import { generateImageViaCli, isCliImageEngineAvailable } from "@/lib/media-svg";

export const maxDuration = 300; // generation can take ~7s per image

// GET: options for the generator UI (models, styles, aspects) plus which engine
// will actually run. Images always come from an OpenRouter image model — the
// local Claude CLI cannot generate images — so the UI needs to know whether one
// is configured and whether the active connection is the CLI.
export async function GET() {
  try {
    await requireAuth();
    const active = await prisma.aiConfig.findFirst({ where: { isActive: true } });
    const openRouter = await prisma.aiConfig.findFirst({ where: { provider: "openrouter" } });
    return NextResponse.json({
      models: IMAGE_MODELS,
      styles: Object.keys(STYLE_PRESETS),
      aspects: Object.keys(ASPECTS),
      activeProvider: active?.provider || null,
      // Model choice is only meaningful when we can reach OpenRouter.
      imageEngineAvailable: !!openRouter,
      // Vector art through the local CLI: free, but only where the binary runs.
      cliEngineAvailable: isCliImageEngineAvailable(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// POST: generate image(s), store them in R2, and add them to the media library.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => ({}));

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "A prompt is required" }, { status: 400 });
    if (prompt.length > 2000) {
      return NextResponse.json({ error: "Prompt is too long (2000 characters max)" }, { status: 400 });
    }

    const r2 = await prisma.r2Config.findFirst({ where: { isActive: true } });
    if (!r2) {
      return NextResponse.json(
        { error: "No R2 storage configured. Set it up in Settings → Cloudflare R2." },
        { status: 400 }
      );
    }

    const style = typeof body.style === "string" ? body.style : "none";
    const aspect = typeof body.aspect === "string" ? body.aspect : "square";
    const engine = body.engine === "cli" ? "cli" : "openrouter";

    const s3Client = () =>
      new S3Client({
        region: "auto",
        endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
      });
    const nameBase =
      prompt.toLowerCase().replace(/[^\w\s-]/g, "").trim().split(/\s+/).slice(0, 5).join("-").slice(0, 50) || "ai-image";

    // Vector route: Claude writes SVG through the local CLI and we rasterise it.
    // Costs nothing per image, and the canvas size is exact rather than a hint.
    if (engine === "cli") {
      const count = Math.max(1, Math.min(4, Number(body.count) || 1));
      const s3 = s3Client();
      const made = [];
      let cost = 0;
      for (let i = 0; i < count; i++) {
        const img = await generateImageViaCli({
          prompt,
          style,
          aspect,
          model: typeof body.model === "string" && /claude|opus|sonnet|haiku/i.test(body.model) ? body.model : undefined,
        });
        cost += img.costUsd;
        const key = `media/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        await s3.send(
          new PutObjectCommand({
            Bucket: r2.bucketName, Key: key, Body: img.png,
            ContentType: "image/png",
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
        made.push(
          await prisma.mediaAsset.create({
            data: {
              name: count > 1 ? `${nameBase}-${i + 1}.png` : `${nameBase}.png`,
              key,
              url: `${r2.publicUrl.replace(/\/+$/, "")}/${key}`,
              mimeType: "image/png",
              size: img.png.length,
              altText: prompt.slice(0, 300),
              source: "ai",
              aiPrompt: prompt,
              aiModel: "local Claude CLI (vector)",
              createdBy: session.id,
            },
          })
        );
      }
      return NextResponse.json({
        assets: made, cost, model: "local Claude CLI (vector)", aspectApplied: true,
      });
    }

    const finalPrompt = buildImagePrompt(prompt, style, aspect);

    const { images, cost, model, aspectApplied } = await generateImages({
      prompt: finalPrompt,
      model: body.model,
      count: Number(body.count) || 1,
      aspectRatio: ASPECT_RATIOS[aspect],
    });

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });

    // Name from the prompt so the library stays browsable.
    const base = prompt.toLowerCase().replace(/[^\w\s-]/g, "").trim().split(/\s+/).slice(0, 5).join("-").slice(0, 50) || "ai-image";

    const assets = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = img.mimeType.split("/")[1] || "png";
      const key = `media/ai/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: r2.bucketName,
          Key: key,
          Body: img.buffer,
          ContentType: img.mimeType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      assets.push(
        await prisma.mediaAsset.create({
          data: {
            name: images.length > 1 ? `${base}-${i + 1}.${ext}` : `${base}.${ext}`,
            key,
            url: `${r2.publicUrl.replace(/\/+$/, "")}/${key}`,
            mimeType: img.mimeType,
            size: img.buffer.length,
            altText: prompt.slice(0, 300),
            source: "ai",
            aiPrompt: prompt,
            aiModel: model,
            createdBy: session.id,
          },
        })
      );
    }

    return NextResponse.json({
      assets,
      cost,
      model,
      aspectApplied,
      ...(aspectApplied ? {} : { notice: "This model ignored the requested shape — the image uses its default proportions." }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
