import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAiCompletion, extractHtmlAndSubject } from "@/lib/ai-complete";

export const maxDuration = 300;

// Turn raw email copy into a designed HTML template. Unlike /generate, which
// invents the words from a brief, this one is handed the words already written
// and must not rewrite them — it only decides how they should look.

// GET: the house style this will apply, so the UI can show it before generating.
export async function GET() {
  try {
    await requireAuth();
    const row = await prisma.appSetting.findUnique({ where: { key: "predefinedInstruction" } });
    const active = await prisma.aiConfig.findFirst({ where: { isActive: true }, select: { provider: true, model: true } });
    return NextResponse.json({
      predefinedInstruction: row?.value || "",
      provider: active?.provider || null,
      model: active?.model || null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

function buildSystemPrompt(houseStyle: string, extra: string): string {
  return [
    "You are an expert email designer. You are given the finished copy for a marketing email and you turn it into a designed, responsive HTML email.",
    "",
    "Absolute rules:",
    "- The words are already written. Preserve them: do not rewrite, summarise, expand, or add marketing copy of your own. Fixing an obvious typo or stray line break is fine.",
    "- Keep the author's order and structure. A line that reads as a heading becomes a heading; a list stays a list; a line like \"Get 50% off\" or a bare URL becomes a call-to-action button.",
    "- If the copy opens with a subject line (a first line labelled \"Subject:\" or an obvious standalone title), use it as the subject and do NOT repeat it as body text.",
    "- If there is no subject line, write one that reuses the copy's own wording.",
    "- Preserve any merge fields such as {{first_name}} or {{FirstName}} exactly as written.",
    "- Inline every style. No <style> blocks, no external CSS, no web fonts, no JavaScript. Table-based layout, max width 600px, readable on mobile.",
    "",
    houseStyle ? `House style, set by this team in Settings → AI. Follow it:\n${houseStyle}` : "",
    extra ? `Additional instructions for this email specifically:\n${extra}` : "",
    "",
    'Return ONLY a JSON object: {"subject": "...", "html": "..."} — no markdown fences, no commentary.',
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => ({}));

    const copy = typeof body.copy === "string" ? body.copy.trim() : "";
    if (!copy) {
      return NextResponse.json({ error: "Paste your email copy first" }, { status: 400 });
    }
    if (copy.length < 30) {
      return NextResponse.json(
        { error: "That's very short — paste the whole email so it can be laid out properly." },
        { status: 400 }
      );
    }

    // The house style from Settings → AI is applied automatically; this is the
    // whole point of the feature, so it is read server-side rather than trusted
    // from the request.
    const setting = await prisma.appSetting.findUnique({ where: { key: "predefinedInstruction" } });
    const houseStyle = (setting?.value || "").trim();
    const extra = typeof body.instructions === "string" ? body.instructions.trim() : "";

    const completion = await runAiCompletion({
      systemPrompt: buildSystemPrompt(houseStyle, extra),
      userPrompt: `Here is the email copy to design:\n\n--- COPY ---\n${copy.slice(0, 20000)}\n--- END COPY ---`,
      maxTokens: 8000,
    });

    if (!completion.text) {
      return NextResponse.json(
        { error: completion.error || "The AI provider returned nothing." },
        { status: 502 }
      );
    }

    const extracted = extractHtmlAndSubject(completion.text);
    if (!extracted) {
      return NextResponse.json(
        { error: "The AI response contained no usable HTML. Try again." },
        { status: 502 }
      );
    }

    // Saved to the library so the design can be reused without spending tokens again.
    const name =
      (extracted.subject || copy.split("\n").find((l: string) => l.trim())?.slice(0, 80) || "Templatized email").trim();
    try {
      await prisma.dynamicTemplate.create({
        data: {
          name,
          subject: extracted.subject || null,
          htmlContent: extracted.html,
          source: "ai",
          aiMode: "templatize",
          prompt: copy.slice(0, 2000),
          createdBy: session.id,
        },
      });
    } catch (err) {
      console.error("[templatize] Failed to persist DynamicTemplate:", err);
    }

    return NextResponse.json({
      html: extracted.html,
      subject: extracted.subject || null,
      name,
      appliedHouseStyle: houseStyle.length > 0,
      provider: completion.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Templatize failed";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
