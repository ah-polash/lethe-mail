import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Read mustChangePassword fresh from the DB (not the token) so the flag
    // clears immediately after the user updates their password. This lookup is
    // best-effort: a DB hiccup must never invalidate an otherwise valid session
    // (the client treats a failed /me as logged-out and redirects to /login).
    let mustChangePassword = false;
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { mustChangePassword: true },
      });
      mustChangePassword = dbUser?.mustChangePassword ?? false;
    } catch {
      // fall through with the session as-is
    }

    return NextResponse.json({ user: { ...session, mustChangePassword } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
