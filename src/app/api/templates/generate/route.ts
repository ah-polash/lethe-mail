import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Try DB-configured AI provider first (OpenRouter, OpenAI, etc.)
    const aiConfig = await prisma.aiConfig.findFirst({ where: { isActive: true } });

    // Fall back to env var for backwards compatibility
    const apiKey = aiConfig?.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = aiConfig?.baseUrl || "https://api.openai.com/v1";
    const model = aiConfig?.model || "gpt-4o-mini";

    if (apiKey) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(aiConfig?.provider === "openrouter" && {
              "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
              "X-Title": "Lethe Mail",
            }),
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: referenceImageUrl
                  ? `You are an expert email template designer. The user has provided a screenshot of an email design as a reference. Analyze the screenshot carefully and recreate a similar email template in HTML. Match the layout, colors, typography, spacing, and overall design as closely as possible. Adapt the content based on the user's prompt. The style should be "${style || "general"}". Return a JSON object with two fields: "html" (the complete HTML email template with all styles inline for email client compatibility) and "subject" (a suggested email subject line). Only return valid JSON, no markdown.`
                  : `You are an expert email template designer. Generate a professional, responsive HTML email template based on the user's prompt. The style should be "${style || "general"}". Return a JSON object with two fields: "html" (the complete HTML email template) and "subject" (a suggested email subject line). The HTML should be inline-styled for maximum email client compatibility. Make the design modern, clean, and professional. Only return valid JSON, no markdown.`,
              },
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
          if (content) {
            // Strip markdown code fences if present
            const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
            const parsed = JSON.parse(cleaned);

            // Save prompt for future reuse
            await prisma.aiPrompt.create({
              data: {
                prompt,
                style: style || "professional",
                name: templateName || null,
                subject: parsed.subject || templateSubject || null,
                referenceImageUrl: referenceImageUrl || null,
                aiMode: aiMode || "true",
                createdBy: session.id,
              },
            }).catch(() => {}); // Don't fail generation if prompt save fails

            return NextResponse.json({
              html: parsed.html,
              subject: parsed.subject,
            });
          }
        }
      } catch {
        // Fall through to default template
      }
    }

    // Fallback to default templates
    const result = getDefaultTemplate(prompt, style || "general");

    // Save prompt for future reuse
    await prisma.aiPrompt.create({
      data: {
        prompt,
        style: style || "professional",
        name: templateName || null,
        subject: result.subject || templateSubject || null,
        createdBy: session.id,
      },
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
