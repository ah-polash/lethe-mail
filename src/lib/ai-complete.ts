import { prisma } from "./db";
import { runClaudeCli } from "./claude-cli";

// One place that knows how to talk to whichever provider is configured. Both the
// template generator and the copy templatizer go through here, so a fix to
// provider handling applies to both rather than to one copy of the code.

export interface AiCompletion {
  /** Raw model text, or null when the call failed. */
  text: string | null;
  /** Human-readable reason the call failed, for the UI to surface. */
  error: string | null;
  provider: string;
}

export async function runAiCompletion(opts: {
  systemPrompt: string;
  userPrompt: string;
  /** Passed to vision-capable providers alongside the prompt. */
  imageUrl?: string | null;
  maxTokens?: number;
}): Promise<AiCompletion> {
  const aiConfig = await prisma.aiConfig.findFirst({ where: { isActive: true } });

  // Env var kept as a fallback for installs that predate the settings UI.
  const apiKey = aiConfig?.apiKey || process.env.OPENAI_API_KEY;
  // Trim trailing slash — `${baseUrl}/messages` produces a 404 path when baseUrl ends in "/".
  const baseUrl = (aiConfig?.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = aiConfig?.model || "gpt-4o-mini";
  const provider = aiConfig?.provider || "openai";
  const maxTokens = opts.maxTokens ?? 4000;
  const { systemPrompt, userPrompt, imageUrl } = opts;

  // The local CLI authenticates itself (Claude subscription), so it runs even
  // with no API key stored.
  if (!apiKey && provider !== "claude-cli") {
    return {
      text: null,
      provider,
      error: "No active AI configuration. Open Settings → AI Configuration to add one.",
    };
  }

  try {
    if (provider === "claude-cli") {
      // Local Claude Code CLI, headless. Only works where the binary exists
      // (a dev machine or self-hosted server) — never on serverless.
      const result = await runClaudeCli({
        prompt: imageUrl ? `${userPrompt}\n\nReference screenshot: ${imageUrl}` : userPrompt,
        systemPrompt,
        model: aiConfig?.model || undefined,
        // baseUrl doubles as the binary path for this provider.
        cliPath: aiConfig?.baseUrl && aiConfig.baseUrl.startsWith("/") ? aiConfig.baseUrl : null,
      });
      return { text: result.text, error: null, provider };
    }

    if (provider === "anthropic") {
      // Anthropic /messages — system is top-level, response has content[0].text
      const userContent: unknown = imageUrl
        ? [
            { type: "text", text: userPrompt },
            { type: "image", source: { type: "url", url: imageUrl } },
          ]
        : userPrompt;

      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          // `temperature` is deprecated on Claude 4.x models — omit it.
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!response.ok) {
        // Anthropic error shape: { type: "error", error: { type, message } }
        const errBody = (await response.json().catch(() => null)) as
          | { error?: { message?: string }; message?: string }
          | null;
        const msg =
          errBody?.error?.message || errBody?.message || `Anthropic API returned HTTP ${response.status}`;
        return { text: null, provider, error: `Anthropic: ${msg}` };
      }

      const data = await response.json();
      // Anthropic returns content as an array of blocks; concatenate text blocks.
      const blocks = Array.isArray(data.content) ? data.content : [];
      const content = blocks
        .filter((b: { type?: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text || "")
        .join("");
      return content.trim()
        ? { text: content, error: null, provider }
        : { text: null, provider, error: "Anthropic returned an empty response." };
    }

    // OpenAI / OpenRouter — /chat/completions
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey || ""}`,
        ...(provider === "openrouter" && {
          "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
          "X-Title": "Lethe Mail",
        }),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: imageUrl
              ? [
                  { type: "text", text: userPrompt },
                  { type: "image_url", image_url: { url: imageUrl } },
                ]
              : userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as
        | { error?: { message?: string } | string }
        | null;
      const errMsg = typeof errBody?.error === "string" ? errBody.error : errBody?.error?.message;
      const msg = errMsg || `API returned HTTP ${response.status}`;
      console.warn("[ai-complete] response not ok:", response.status, msg);
      return { text: null, provider, error: `${provider}: ${msg}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim()
      ? { text: content, error: null, provider }
      : { text: null, provider, error: "AI returned an empty response." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[ai-complete] request failed:", err);
    return { text: null, provider, error: `${provider}: ${msg}` };
  }
}

/**
 * Best-effort extraction of { html, subject } from a model response that may not
 * be strict JSON — fenced blocks, prose around the object, or bare HTML.
 */
export function extractHtmlAndSubject(raw: string): { html: string; subject?: string } | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^\s*```(?:json|html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const fromObject = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && typeof parsed.html === "string") {
        return {
          html: parsed.html as string,
          subject: typeof parsed.subject === "string" ? (parsed.subject as string) : undefined,
        };
      }
    } catch {
      // fall through to the next strategy
    }
    return null;
  };

  const direct = fromObject(cleaned);
  if (direct) return direct;

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const embedded = fromObject(cleaned.slice(firstBrace, lastBrace + 1));
    if (embedded) return embedded;
  }

  // Plain HTML response with no JSON wrapper.
  if (/<\s*(html|body|table|div|h\d|p|a|img)\b/i.test(cleaned)) return { html: cleaned };

  return null;
}
