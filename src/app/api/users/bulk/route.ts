import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireSuperAdmin, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, resolveNotificationSender } from "@/lib/ses";

// Readable random password: 12 chars from an unambiguous alphabet (no 0/O/1/l).
const PW_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PW_ALPHABET[crypto.randomInt(PW_ALPHABET.length)];
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nameFromEmail(email: string): string {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return local
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || email;
}

function credentialsHtml(brand: string, loginUrl: string, email: string, password: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;">Welcome to ${brand}</h1>
      <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">
        An account has been created for you. Use these credentials to sign in:
      </p>
      <div style="background:#f4f4f7;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:14px;"><strong>Email:</strong> ${email}</p>
        <p style="margin:0;font-size:14px;"><strong>Temporary password:</strong> <code style="font-size:15px;">${password}</code></p>
      </div>
      <p style="margin:0 0 24px;color:#b45309;font-size:13px;line-height:1.5;">
        ⚠️ For security, you'll be required to set your own password the first time you log in.
      </p>
      <a href="${loginUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;">
        Log in to ${brand}
      </a>
    </div>
    <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">
      If you weren't expecting this email, you can ignore it.
    </p>
  </div>
</body>
</html>`;
}

interface BulkResult {
  email: string;
  status: "created" | "skipped_exists" | "invalid";
  emailSent: boolean;
  // Only included when the credentials email could NOT be sent, so the admin
  // can share it manually. Never included for successfully emailed users.
  tempPassword?: string;
  emailError?: string;
}

// POST: bulk-create users from a comma/space/newline-separated email list and
// email each a random temporary password (forced change on first login).
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await request.json().catch(() => ({}));

    const raw = typeof body.emails === "string" ? body.emails : "";
    const role = body.role === "super_admin" ? "super_admin" : "general_user";

    // Accept commas, semicolons, whitespace, and newlines as separators.
    const parsed = Array.from(
      new Set(
        raw
          .split(/[\s,;]+/)
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean)
      )
    ) as string[];

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No email addresses found" }, { status: 400 });
    }
    if (parsed.length > 100) {
      return NextResponse.json({ error: "Maximum 100 users per batch" }, { status: 400 });
    }

    // Sender: the active connection's default From address, or any verified
    // SES identity if that setting was never filled in.
    const sender = await resolveNotificationSender();
    const fromEmail = sender.fromEmail;
    const brandSetting = await prisma.appSetting.findUnique({ where: { key: "brand.name" } });
    const brand = brandSetting?.value?.trim() || "bPlugins";
    const baseUrl = (
      process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");
    const loginUrl = `${baseUrl}/login`;

    const results: BulkResult[] = [];

    for (const email of parsed) {
      if (!EMAIL_RE.test(email)) {
        results.push({ email, status: "invalid", emailSent: false });
        continue;
      }
      const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (exists) {
        results.push({ email, status: "skipped_exists", emailSent: false });
        continue;
      }

      const tempPassword = randomPassword();
      await prisma.user.create({
        data: {
          email,
          name: nameFromEmail(email),
          passwordHash: await hashPassword(tempPassword),
          role,
          mustChangePassword: true,
        },
      });

      // Send credentials. If sending fails, still keep the user but return the
      // password so the admin can deliver it manually.
      if (!fromEmail) {
        results.push({
          email,
          status: "created",
          emailSent: false,
          tempPassword,
          emailError: sender.error || "No sender address available for notifications",
        });
        continue;
      }

      const sent = await sendEmail({
        to: [email],
        subject: `Your ${brand} account — login details inside`,
        htmlBody: credentialsHtml(brand, loginUrl, email, tempPassword),
        fromEmail,
        fromName: brand,
      });

      if (sent.error) {
        results.push({ email, status: "created", emailSent: false, tempPassword, emailError: sent.error });
      } else {
        results.push({ email, status: "created", emailSent: true });
      }
    }

    const summary = {
      created: results.filter((r) => r.status === "created").length,
      emailed: results.filter((r) => r.emailSent).length,
      skipped: results.filter((r) => r.status === "skipped_exists").length,
      invalid: results.filter((r) => r.status === "invalid").length,
    };

    return NextResponse.json({ summary, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
