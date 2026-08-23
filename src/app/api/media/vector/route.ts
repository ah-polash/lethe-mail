import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateVectorFromEmail, isCliImageEngineAvailable, SVG_DIMENSIONS } from "@/lib/media-svg";
import { OUTPUT_FORMATS, FRAME_DELAY_MS } from "@/lib/media-animate";

export const maxDuration = 300;

// GET: whether this machine can run the vector engine, plus the shapes offered.
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({
      available: isCliImageEngineAvailable(),
      shapes: Object.entries(SVG_DIMENSIONS).map(([key, d]) => ({ key, ...d })),
      formats: OUTPUT_FORMATS.map(({ key, label, animated, note }) => ({ key, label, animated, note })),
      frameDelayMs: FRAME_DELAY_MS,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// POST: read the pasted email copy and design matching artwork. This returns the
// SVG keyframes themselves rather than a file — the browser previews the real
// vector, then /api/media/vector/save encodes whichever format is chosen. One
// design can therefore be saved as a still, a GIF and an APNG without redrawing.
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
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

    // Checked up front: saving needs R2, and finding that out after a two-minute
    // wait would be miserable.
    const r2 = await prisma.r2Config.findFirst({ where: { isActive: true } });
    if (!r2) {
      return NextResponse.json(
        { error: "No R2 storage configured. Set it up in Settings → Cloudflare R2." },
        { status: 400 }
      );
    }

    const cliConfig = await prisma.aiConfig.findFirst({ where: { provider: "claude-cli" } });
    const cliPath = cliConfig?.baseUrl?.startsWith("/") ? cliConfig.baseUrl : null;

    const design = await generateVectorFromEmail({
      emailText,
      style: typeof body.style === "string" ? body.style : "hero",
      aspect: typeof body.aspect === "string" ? body.aspect : "banner",
      model: cliConfig?.model || undefined,
      cliPath,
      frames: Number(body.frames) || undefined,
    });

    return NextResponse.json({
      frames: design.frames,
      title: design.title,
      altText: design.altText,
      width: design.width,
      height: design.height,
      dimensions: `${design.width}×${design.height}`,
      frameDelayMs: FRAME_DELAY_MS,
      engine: design.engine,
      cost: design.costUsd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vector generation failed";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
