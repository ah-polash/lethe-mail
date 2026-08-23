import { prisma } from "./db";

// Image generation runs through OpenRouter's chat-completions API with
// `modalities: ["image","text"]`; the result comes back as a data: URL on the
// assistant message. (The configured text models — Claude, Gemini Flash text —
// cannot produce images, so this deliberately picks its own model.)

export interface ImageModel {
  id: string;
  label: string;
  note: string;
  approxCost: string;
}

// Curated rather than "everything OpenRouter lists": these are the models worth
// offering for email artwork, cheapest first.
export const IMAGE_MODELS: ImageModel[] = [
  { id: "google/gemini-2.5-flash-image", label: "Fast (Gemini 2.5 Flash)", note: "Quick drafts and simple banners", approxCost: "~$0.04 / image" },
  { id: "google/gemini-3.1-flash-image", label: "Balanced (Gemini 3.1 Flash)", note: "Better detail, still fast", approxCost: "~$0.05 / image" },
  { id: "google/gemini-3-pro-image", label: "High quality (Gemini 3 Pro)", note: "Best for hero images", approxCost: "~$0.10 / image" },
  { id: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini", note: "Strong text rendering in images", approxCost: "~$0.06 / image" },
  { id: "openai/gpt-5-image", label: "GPT-5 Image", note: "Highest fidelity, slowest", approxCost: "~$0.15 / image" },
];

export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0].id;

// Style presets shape the prompt; they are not model parameters.
export const STYLE_PRESETS: Record<string, string> = {
  none: "",
  hero: "Design as a polished marketing email hero banner. Clean composition with clear focal point, generous negative space, no text or lettering.",
  product: "Product photography style: the subject centred on a clean seamless background, soft studio lighting, crisp shadows, no text.",
  illustration: "Modern flat vector illustration, bold simple shapes, limited harmonious palette, clean lines, no text.",
  icon: "A simple iconographic image, centred subject, flat solid background, high contrast, minimal detail, no text.",
  background: "An abstract background texture: subtle, low contrast, no focal subject, suitable to place text over. No lettering.",
  photo: "Photorealistic image, natural lighting, shallow depth of field, editorial quality, no text.",
};

// Chat image models take no size parameter, so aspect is expressed in the prompt.
export const ASPECT_RATIOS: Record<string, string> = {
  square: "1:1",
  landscape: "16:9",
  banner: "3:1",
  portrait: "3:4",
};

export const ASPECTS: Record<string, string> = {
  square: "Square 1:1 composition.",
  landscape: "Wide 16:9 landscape composition.",
  banner: "Very wide 3:1 email banner composition, short and wide.",
  portrait: "Vertical 3:4 portrait composition.",
};

export function buildImagePrompt(prompt: string, style: string, aspect: string): string {
  return [prompt.trim(), STYLE_PRESETS[style] || "", ASPECTS[aspect] || ""]
    .filter(Boolean)
    .join("\n\n");
}

async function getOpenRouterKey(): Promise<string> {
  // Any OpenRouter credential works for image models; prefer the active one.
  const cfg =
    (await prisma.aiConfig.findFirst({ where: { provider: "openrouter", isActive: true } })) ||
    (await prisma.aiConfig.findFirst({ where: { provider: "openrouter" } }));
  if (!cfg) {
    throw new Error(
      "Image generation needs an OpenRouter connection. Add one in Settings → AI Configuration."
    );
  }
  return cfg.apiKey;
}

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

// Returns the raw images; storing them is the caller's job.
export async function generateImages(opts: {
  prompt: string;
  model?: string;
  count?: number;
  aspectRatio?: string; // e.g. "3:1" — honoured by models that support it
}): Promise<{ images: GeneratedImage[]; cost: number; model: string }> {
  const apiKey = await getOpenRouterKey();
  const model = IMAGE_MODELS.some((m) => m.id === opts.model)
    ? (opts.model as string)
    : DEFAULT_IMAGE_MODEL;
  const count = Math.max(1, Math.min(4, opts.count ?? 1));

  // One request per image: these models return a single image per completion,
  // and separate calls give genuinely different variations.
  const results = await Promise.all(
    Array.from({ length: count }, async () => {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: opts.prompt }],
          modalities: ["image", "text"],
          // Not every image model honours this; the prompt also states the
          // shape, and models that ignore both return a square.
          ...(opts.aspectRatio ? { image_config: { aspect_ratio: opts.aspectRatio } } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const providerMessage: string = data?.error?.message || "";
        if (res.status === 402 || /credit/i.test(providerMessage)) {
          throw new Error(
            "OpenRouter credits are exhausted — top up at openrouter.ai/credits, then try again."
          );
        }
        if (res.status === 401) {
          throw new Error("OpenRouter rejected the API key. Check it in Settings → AI Configuration.");
        }
        if (res.status === 429) {
          throw new Error("OpenRouter is rate-limiting image requests. Wait a moment and retry.");
        }
        throw new Error(providerMessage || `Image generation failed (${res.status})`);
      }
      const raw: string =
        data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
        data?.choices?.[0]?.message?.images?.[0]?.url ||
        "";
      if (!raw.startsWith("data:")) {
        throw new Error("The model returned no image — try rephrasing the prompt.");
      }
      const mimeType = raw.slice(5, raw.indexOf(";")) || "image/png";
      const buffer = Buffer.from(raw.split(",")[1] || "", "base64");
      return { image: { buffer, mimeType }, cost: Number(data?.usage?.cost || 0) };
    })
  );

  return {
    images: results.map((r) => r.image),
    cost: results.reduce((s, r) => s + r.cost, 0),
    model,
  };
}
