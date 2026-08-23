import { Resvg } from "@resvg/resvg-js";
import { runClaudeCli, resolveClaudeCli } from "./claude-cli";

// Claude cannot emit raster images, but it writes SVG well. So: ask the local
// CLI for SVG markup, then rasterise it here to a PNG — which every email client
// renders, unlike SVG itself (Gmail strips it). Costs nothing per image beyond
// the Claude subscription already being paid for.

export function isCliImageEngineAvailable(cliPath?: string | null): boolean {
  return resolveClaudeCli(cliPath) !== null;
}

// Output sizes per shape. Widths stay email-friendly (600–1200px, retina-ready).
export const SVG_DIMENSIONS: Record<string, { width: number; height: number }> = {
  banner: { width: 1200, height: 300 },
  landscape: { width: 1200, height: 675 },
  square: { width: 1024, height: 1024 },
  portrait: { width: 900, height: 1200 },
};

const STYLE_GUIDANCE: Record<string, string> = {
  none: "",
  hero: "A polished email hero banner: bold background treatment, a clear focal shape, generous empty space where text could be overlaid.",
  product: "A stylised product-card scene: a simple device or package silhouette centred on a clean background with a soft shadow.",
  illustration: "A modern flat vector illustration with bold simple shapes and a limited harmonious palette.",
  icon: "A single centred iconographic symbol on a flat background, high contrast, minimal detail.",
  background: "An abstract decorative background: gradients, soft blobs or subtle geometry, low contrast, nothing that competes with overlaid text.",
  photo: "Photorealism is not achievable in vector form — instead produce a rich, layered illustrative scene with gradients and depth.",
};

function buildSvgPrompt(prompt: string, style: string, width: number, height: number): string {
  return `Create an SVG illustration for a marketing email.

Subject: ${prompt}
${STYLE_GUIDANCE[style] ? `Art direction: ${STYLE_GUIDANCE[style]}` : ""}

Hard requirements:
- Output ONLY the SVG markup. No explanation, no markdown fences, no commentary.
- Root element must be exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
- Self-contained: no external images, no <image href>, no web fonts, no scripts, no CSS classes — use presentation attributes or inline style only.
- Do NOT include any text or lettering: wording is added in the email HTML.
- Compose deliberately for a ${width}×${height} canvas; fill the whole canvas edge to edge.
- Use gradients, layered shapes and opacity for depth. Aim for something a designer would ship, not clip art.`;
}

/** Pull the <svg> element out of whatever the model returned. */
export function extractSvg(text: string): string | null {
  const cleaned = text.replace(/^\s*```(?:svg|xml|html)?\s*/i, "").replace(/```\s*$/i, "");
  const start = cleaned.indexOf("<svg");
  const end = cleaned.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end < start) return null;
  return cleaned.slice(start, end + "</svg>".length);
}

// Defence in depth: the markup is rendered server-side and stored, so strip
// anything active before it reaches the rasteriser.
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
}

export interface SvgImageResult {
  png: Buffer;
  svg: string;
  width: number;
  height: number;
  costUsd: number;
}

export async function generateImageViaCli(opts: {
  prompt: string;
  style?: string;
  aspect?: string;
  model?: string;
  cliPath?: string | null;
}): Promise<SvgImageResult> {
  const dims = SVG_DIMENSIONS[opts.aspect || "banner"] || SVG_DIMENSIONS.banner;

  const result = await runClaudeCli({
    prompt: buildSvgPrompt(opts.prompt, opts.style || "none", dims.width, dims.height),
    systemPrompt:
      "You are a senior vector illustrator. You reply with raw SVG markup only — never prose, never markdown fences.",
    model: opts.model,
    cliPath: opts.cliPath,
    timeoutMs: 240_000,
  });

  const raw = extractSvg(result.text);
  if (!raw) {
    throw new Error("The CLI did not return SVG markup. Try rephrasing the description.");
  }
  const svg = sanitizeSvg(raw);

  let png: Buffer;
  try {
    const renderer = new Resvg(svg, { fitTo: { mode: "width", value: dims.width } });
    png = Buffer.from(renderer.render().asPng());
  } catch (e) {
    throw new Error(
      `The generated SVG could not be rendered: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

  return { png, svg, width: dims.width, height: dims.height, costUsd: result.costUsd };
}

// --- Vector art derived from email copy -------------------------------------
// Rather than asking the user to describe a picture, read the email they are
// sending and design artwork that matches it. One model call returns the title,
// alt text and SVG together, so the whole thing costs a single round trip.

export interface VectorFromEmail {
  png: Buffer;
  svg: string;
  title: string;
  altText: string;
  width: number;
  height: number;
  costUsd: number;
  engine: string;
}

function buildEmailArtPrompt(emailText: string, style: string, width: number, height: number): string {
  return `Read this marketing email and design a single illustration to sit at the top of it.

--- EMAIL ---
${emailText.slice(0, 6000)}
--- END EMAIL ---

${STYLE_GUIDANCE[style] ? `Art direction: ${STYLE_GUIDANCE[style]}` : ""}

Decide for yourself what imagery suits the email's subject and tone, then return a JSON object with exactly these keys:
{
  "title": "a short filename-style name for the image, 2-5 words, lowercase words separated by spaces",
  "altText": "one sentence describing the image for screen readers and for when images are blocked",
  "svg": "the complete SVG markup"
}

Rules for the SVG:
- Root element exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
- Self-contained: no external images, no <image href>, no web fonts, no scripts, no CSS classes — presentation attributes or inline style only.
- No text or lettering anywhere in the artwork; the email supplies the words.
- Compose for the full ${width}×${height} canvas, edge to edge.
- Use gradients, layered shapes and opacity for depth. It should look designed, not like clip art.

Return ONLY the JSON object. No markdown fences, no commentary.`;
}

/** Tolerant JSON extraction — models sometimes wrap the object in prose or fences. */
function parseArtJson(text: string): { title?: string; altText?: string; svg?: string } | null {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
  }
  return null;
}

export async function generateVectorFromEmail(opts: {
  emailText: string;
  style?: string;
  aspect?: string;
  model?: string;
  cliPath?: string | null;
}): Promise<VectorFromEmail> {
  const dims = SVG_DIMENSIONS[opts.aspect || "banner"] || SVG_DIMENSIONS.banner;
  const prompt = buildEmailArtPrompt(opts.emailText, opts.style || "hero", dims.width, dims.height);

  const result = await runClaudeCli({
    prompt,
    systemPrompt:
      "You are a senior vector illustrator and art director. You reply with a single raw JSON object and nothing else.",
    model: opts.model,
    cliPath: opts.cliPath,
    timeoutMs: 300_000,
  });

  const parsed = parseArtJson(result.text);
  // The SVG may arrive inside the JSON, or the model may have skipped the
  // envelope and returned bare markup — accept either.
  const rawSvg = parsed?.svg ? extractSvg(parsed.svg) : extractSvg(result.text);
  if (!rawSvg) {
    throw new Error("The model did not return usable SVG. Try again, or shorten the email text.");
  }

  const svg = sanitizeSvg(rawSvg);
  let png: Buffer;
  try {
    png = Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: dims.width } }).render().asPng());
  } catch (e) {
    throw new Error(
      `The generated SVG could not be rendered: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

  const title = (parsed?.title || "email illustration").toString().trim().slice(0, 80);
  const altText = (parsed?.altText || title).toString().trim().slice(0, 300);

  return {
    png, svg, title, altText,
    width: dims.width, height: dims.height,
    costUsd: result.costUsd,
    engine: "local Claude CLI (vector)",
  };
}
