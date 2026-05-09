import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/ses";

interface PreviewBody {
  to?: string;
  subject?: string;
  htmlContent?: string;
  fromEmail?: string;
  fromName?: string;
  varValues?: Record<string, string>;
}

function resolveMergeTags(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const v = values[key];
    return v !== undefined && v !== "" ? v : `{{${key}}}`;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = (await request.json().catch(() => ({}))) as PreviewBody;
    const to = (body.to || "").trim();
    const subject = body.subject || "";
    const htmlContent = body.htmlContent || "";
    const fromEmail = (body.fromEmail || "").trim();
    const fromName = body.fromName || "";
    const varValues = body.varValues || {};

    if (!EMAIL_RE.test(to)) {
      return NextResponse.json({ error: "Valid recipient email is required" }, { status: 400 });
    }
    if (!fromEmail) {
      return NextResponse.json({ error: "Sender email is required" }, { status: 400 });
    }
    if (!htmlContent.trim()) {
      return NextResponse.json({ error: "Email content is empty" }, { status: 400 });
    }

    const resolvedSubject = `[Preview] ${resolveMergeTags(subject, varValues)}`;
    const resolvedHtml = resolveMergeTags(htmlContent, varValues);

    const result = await sendEmail({
      to: [to],
      subject: resolvedSubject,
      htmlBody: resolvedHtml,
      fromEmail,
      fromName,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ messageId: result.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
