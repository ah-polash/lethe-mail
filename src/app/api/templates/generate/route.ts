import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Best-effort extraction of { html, subject } from an LLM response that may not be strict JSON.
// Returns html (and optional subject) on success, null if nothing usable was found.
function extractHtmlAndSubject(raw: string): { html: string; subject?: string } | null {
  if (!raw) return null;
  // Strip markdown fences (```json or ```html) plus surrounding whitespace.
  const cleaned = raw
    .replace(/^\s*```(?:json|html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // 1) Direct JSON parse.
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      const html = typeof parsed.html === "string" ? parsed.html : null;
      const subject = typeof parsed.subject === "string" ? parsed.subject : undefined;
      if (html) return { html, subject };
    }
  } catch {
    // Try other strategies
  }

  // 2) Locate the first {...} block in the text and parse it.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        const html = typeof parsed.html === "string" ? parsed.html : null;
        const subject = typeof parsed.subject === "string" ? parsed.subject : undefined;
        if (html) return { html, subject };
      }
    } catch {
      // Try plain HTML fallback
    }
  }

  // 3) Plain HTML response (no JSON wrapper) — accept if it looks like HTML.
  if (/<\s*(html|body|table|div|h\d|p|a|img)\b/i.test(cleaned)) {
    return { html: cleaned };
  }

  return null;
}

function getDefaultTemplate(prompt: string, style: string): { html: string; subject: string } {
  const baseStyles = `
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { padding: 40px 30px; text-align: center; }
    .content { padding: 30px; }
    .footer { padding: 20px 30px; text-align: center; font-size: 12px; color: #999999; background-color: #f4f4f7; }
    h1 { margin: 0 0 16px; font-size: 28px; line-height: 1.3; }
    p { margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; }
  `;

  switch (style) {
    case "promotional":
      return {
        subject: `Special Offer - ${prompt}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${baseStyles}
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; }
  .btn { background-color: #667eea; color: #ffffff; }
  .highlight { background-color: #f0f0ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
  .price { font-size: 36px; font-weight: 700; color: #667eea; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Limited Time Offer</h1>
    <p style="color: #e0e0ff; margin: 0;">Don't miss out on this exclusive deal</p>
  </div>
  <div class="content">
    <h2 style="color: #333;">${prompt}</h2>
    <p>We're excited to bring you this exclusive promotional offer. Take advantage of this limited-time deal before it expires.</p>
    <div class="highlight">
      <p style="margin: 0 0 8px; color: #666;">Starting from</p>
      <p class="price" style="margin: 0 0 8px;">$29.99</p>
      <p style="margin: 0; color: #666;">Per month</p>
    </div>
    <p>This offer includes premium features, priority support, and much more. Act now to secure your spot.</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="#" class="btn">Claim Your Offer</a>
    </p>
  </div>
  <div class="footer">
    <p>You received this email because you subscribed to our mailing list.</p>
  </div>
</div>
</body>
</html>`,
      };

    case "newsletter":
      return {
        subject: `Newsletter - ${prompt}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${baseStyles}
  .header { background-color: #1a1a2e; color: #ffffff; }
  .btn { background-color: #e94560; color: #ffffff; }
  .article { border-bottom: 1px solid #eeeeee; padding: 20px 0; }
  .article:last-child { border-bottom: none; }
  .article-tag { display: inline-block; background-color: #e94560; color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Weekly Newsletter</h1>
    <p style="color: #aaa; margin: 0;">${prompt}</p>
  </div>
  <div class="content">
    <div class="article">
      <span class="article-tag">Featured</span>
      <h2 style="margin: 12px 0 8px;">Top Story of the Week</h2>
      <p>Stay informed with our curated selection of the most important updates and insights from this week.</p>
      <a href="#" style="color: #e94560; font-weight: 600;">Read more &rarr;</a>
    </div>
    <div class="article">
      <span class="article-tag">Insights</span>
      <h2 style="margin: 12px 0 8px;">Industry Trends & Analysis</h2>
      <p>Deep dive into the latest trends shaping our industry and what they mean for you.</p>
      <a href="#" style="color: #e94560; font-weight: 600;">Read more &rarr;</a>
    </div>
    <div class="article">
      <span class="article-tag">Tips</span>
      <h2 style="margin: 12px 0 8px;">Practical Tips & Resources</h2>
      <p>Actionable advice and curated resources to help you stay ahead of the curve.</p>
      <a href="#" style="color: #e94560; font-weight: 600;">Read more &rarr;</a>
    </div>
  </div>
  <div class="footer">
    <p>You received this newsletter because you subscribed to our updates.</p>
  </div>
</div>
</body>
</html>`,
      };

    case "announcement":
      return {
        subject: `Announcement - ${prompt}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${baseStyles}
  .header { background: linear-gradient(135deg, #0f3443 0%, #34e89e 100%); color: #ffffff; padding: 50px 30px; }
  .btn { background-color: #34e89e; color: #0f3443; }
  .icon { font-size: 48px; margin-bottom: 16px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div class="icon">&#127881;</div>
    <h1>${prompt}</h1>
    <p style="color: #c0f0d8; margin: 0; font-size: 18px;">We have exciting news to share with you</p>
  </div>
  <div class="content">
    <p>We are thrilled to announce something special. This is a significant milestone and we wanted you to be among the first to know.</p>
    <p>Here's what this means for you:</p>
    <ul style="padding-left: 20px;">
      <li style="margin-bottom: 8px;">Enhanced features and capabilities</li>
      <li style="margin-bottom: 8px;">Improved user experience</li>
      <li style="margin-bottom: 8px;">New opportunities and possibilities</li>
    </ul>
    <p>We're committed to continuous improvement and your feedback matters to us.</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="#" class="btn">Learn More</a>
    </p>
  </div>
  <div class="footer">
    <p>You received this email because you are a valued member of our community.</p>
  </div>
</div>
</body>
</html>`,
      };

    case "transactional":
      return {
        subject: `${prompt}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${baseStyles}
  .header { background-color: #ffffff; border-bottom: 3px solid #2563eb; padding: 30px; }
  .header h1 { color: #2563eb; font-size: 22px; }
  .btn { background-color: #2563eb; color: #ffffff; }
  .info-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
  .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
  .info-row:last-child { border-bottom: none; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>${prompt}</h1>
  </div>
  <div class="content">
    <p>Hello,</p>
    <p>This email confirms your recent activity. Please review the details below.</p>
    <div class="info-box">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #666;">Reference</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">#REF-12345</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #666;">Date</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">March 15, 2026</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Status</td><td style="padding: 8px 0; text-align: right; font-weight: 600; color: #16a34a;">Confirmed</td></tr>
      </table>
    </div>
    <p>If you did not initiate this action, please contact our support team immediately.</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="#" class="btn">View Details</a>
    </p>
  </div>
  <div class="footer">
    <p>This is an automated transactional email. Please do not reply directly.</p>
  </div>
</div>
</body>
</html>`,
      };

    default:
      return {
        subject: `${prompt}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${baseStyles}
  .header { background-color: #4f46e5; color: #ffffff; }
  .btn { background-color: #4f46e5; color: #ffffff; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>${prompt}</h1>
  </div>
  <div class="content">
    <p>Hello,</p>
    <p>Thank you for being a valued part of our community. We wanted to reach out with some important information.</p>
    <p>We are always working to bring you the best experience possible. Stay tuned for more updates.</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="#" class="btn">Learn More</a>
    </p>
  </div>
  <div class="footer">
    <p>You received this email because you subscribed to our mailing list.</p>
  </div>
</div>
</body>
</html>`,
      };
  }

  // Generic default for unknown styles
  return {
    subject: prompt.slice(0, 80),
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background:#f4f4f7;">
<div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;">
  <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#222;">${prompt.replace(/[<>&]/g, "")}</h1>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#444;">Replace this with your content.</p>
  <p style="text-align:center;margin-top:24px;">
    <a href="#" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Learn more</a>
  </p>
</div>
<div style="max-width:600px;margin:0 auto;padding:16px;text-align:center;font-size:12px;color:#999;">
  You received this email because you subscribed to our mailing list.
</div>
</body></html>`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const { prompt, style, templateName, templateSubject, referenceImageUrl, aiMode } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Try DB-configured AI provider first (OpenRouter, OpenAI, Anthropic, etc.)
    const aiConfig = await prisma.aiConfig.findFirst({ where: { isActive: true } });

    // Fall back to env var for backwards compatibility
    const apiKey = aiConfig?.apiKey || process.env.OPENAI_API_KEY;
    // Trim trailing slash — `${baseUrl}/messages` produces a 404 path when baseUrl ends in "/".
    const baseUrl = (aiConfig?.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = aiConfig?.model || "gpt-4o-mini";
    const provider = aiConfig?.provider || "openai";

    let generatedHtml: string | null = null;
    let generatedSubject: string | null = null;
    // Surfaced back to the caller so the UI can show why the AI call failed
    // instead of silently returning a generic fallback template.
    let aiError: string | null = null;

    if (apiKey) {
      const systemPrompt = referenceImageUrl
        ? `You are an expert email template designer. The user has provided a screenshot of an email design as a reference. Analyze the screenshot carefully and recreate a similar email template in HTML. Match the layout, colors, typography, spacing, and overall design as closely as possible. Adapt the content based on the user's prompt. The style should be "${style || "general"}". Return a JSON object with two fields: "html" (the complete HTML email template with all styles inline for email client compatibility) and "subject" (a suggested email subject line). Only return valid JSON, no markdown.`
        : `You are an expert email template designer. Generate a professional, responsive HTML email template based on the user's prompt. The style should be "${style || "general"}". Return a JSON object with two fields: "html" (the complete HTML email template) and "subject" (a suggested email subject line). The HTML should be inline-styled for maximum email client compatibility. Make the design modern, clean, and professional. Only return valid JSON, no markdown.`;

      try {
        if (provider === "anthropic") {
          // Anthropic /messages — system is top-level, response has content[0].text
          const userContent: unknown = referenceImageUrl
            ? [
                { type: "text", text: prompt || "Recreate this email design as an HTML email template." },
                { type: "image", source: { type: "url", url: referenceImageUrl } },
              ]
            : prompt;

          const response = await fetch(`${baseUrl}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 4000,
              // `temperature` is deprecated on Claude 4.x models — omit it.
              system: systemPrompt,
              messages: [{ role: "user", content: userContent }],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            // Anthropic returns content as an array of blocks; concatenate text blocks.
            const blocks = Array.isArray(data.content) ? data.content : [];
            const content = blocks
              .filter((b: { type?: string }) => b.type === "text")
              .map((b: { text?: string }) => b.text || "")
              .join("");
            if (content.trim() !== "") {
              const extracted = extractHtmlAndSubject(content);
              if (extracted) {
                generatedHtml = extracted.html;
                generatedSubject = extracted.subject ?? null;
              } else {
                aiError = "Could not extract HTML/subject from the Anthropic response. Try a different prompt.";
                console.warn("[ai-generate] Could not extract html/subject from Anthropic response");
              }
            } else {
              aiError = "Anthropic returned an empty response.";
            }
          } else {
            // Anthropic error shape: { type: "error", error: { type, message } }
            const errBody = (await response.json().catch(() => null)) as
              | { error?: { message?: string; type?: string }; message?: string }
              | null;
            const msg =
              errBody?.error?.message ||
              errBody?.message ||
              `Anthropic API returned HTTP ${response.status}`;
            aiError = `Anthropic: ${msg}`;
            console.warn("[ai-generate] Anthropic response not ok:", response.status, msg);
          }
        } else {
          // OpenAI / OpenRouter — /chat/completions
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
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
                  content: referenceImageUrl
                    ? [
                        { type: "text", text: prompt || "Recreate this email design as an HTML email template." },
                        { type: "image_url", image_url: { url: referenceImageUrl } },
                      ]
                    : prompt,
                },
              ],
              temperature: 0.7,
              max_tokens: 4000,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (typeof content === "string" && content.trim() !== "") {
              const extracted = extractHtmlAndSubject(content);
              if (extracted) {
                generatedHtml = extracted.html;
                generatedSubject = extracted.subject ?? null;
              } else {
                aiError = "Could not extract HTML/subject from the AI response.";
                console.warn("[ai-generate] Could not extract html/subject from LLM response");
              }
            } else {
              aiError = "AI returned an empty response.";
            }
          } else {
            const errBody = (await response.json().catch(() => null)) as
              | { error?: { message?: string } | string }
              | null;
            const errMsg =
              typeof errBody?.error === "string"
                ? errBody.error
                : errBody?.error?.message;
            const msg = errMsg || `API returned HTTP ${response.status}`;
            aiError = `${provider}: ${msg}`;
            console.warn("[ai-generate] LLM response not ok:", response.status, msg);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        aiError = `${provider}: ${msg}`;
        console.warn("[ai-generate] LLM request failed:", err);
      }
    } else {
      aiError = "No active AI configuration. Open Settings → AI Configuration to add one.";
    }

    // Fall back to a deterministic template if the LLM didn't produce usable content.
    if (!generatedHtml) {
      const result = getDefaultTemplate(prompt, style || "general");
      generatedHtml = result.html;
      generatedSubject = result.subject;
    }

    // Always persist the generated result so "Use Previous Results" can replay it for free.
    try {
      await prisma.aiPrompt.create({
        data: {
          prompt,
          style: style || "professional",
          name: templateName || null,
          subject: generatedSubject || templateSubject || null,
          referenceImageUrl: referenceImageUrl || null,
          aiMode: aiMode || "true",
          generatedHtml,
          generatedSubject,
          createdBy: session.id,
        },
      });
    } catch (err) {
      console.error("[ai-generate] Failed to persist AiPrompt:", err);
    }

    // Also persist as a DynamicTemplate row so the result appears under
    // "Use Previous Results" and the Dynamic Templates menu page.
    try {
      const fallbackName =
        (typeof templateName === "string" && templateName.trim()) ||
        (typeof generatedSubject === "string" && generatedSubject.trim()) ||
        (typeof templateSubject === "string" && templateSubject.trim()) ||
        `AI ${aiMode === "product-update" ? "Product Update" : "Email"} — ${new Date().toLocaleString()}`;
      await prisma.dynamicTemplate.create({
        data: {
          name: fallbackName,
          subject: generatedSubject || templateSubject || null,
          htmlContent: generatedHtml,
          source: "ai",
          aiMode: aiMode || "true",
          prompt: prompt || null,
          createdBy: session.id,
        },
      });
    } catch (err) {
      console.error("[ai-generate] Failed to persist DynamicTemplate:", err);
    }

    return NextResponse.json({
      html: generatedHtml,
      subject: generatedSubject,
      // When set, the LLM call failed and a deterministic fallback template
      // was returned. The UI should surface this so the user knows the
      // provider didn't actually generate the content.
      aiError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
