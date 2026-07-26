import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST: set a new password for the logged-in user and clear the forced-change
// flag. Used by /change-password (mandatory for bulk-created users).
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => ({}));

    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
