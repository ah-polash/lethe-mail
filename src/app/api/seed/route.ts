import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const existingUsers = await prisma.user.count();

    if (existingUsers > 0) {
      return NextResponse.json(
        { error: "Users already exist. Seeding is not allowed." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword("admin123");

    const user = await prisma.user.create({
      data: {
        email: "admin@bplugins.com",
        name: "Super Admin",
        passwordHash,
        role: "super_admin",
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
