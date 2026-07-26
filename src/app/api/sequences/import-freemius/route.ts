import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveFreemiusCreds, listProducts } from "@/lib/freemius";

// POST: Pull products from the active Freemius account and create one sequence
// per product — sequence id = Freemius product id, sequence name = product name.
// Existing sequences (same id) are left untouched and reported as skipped.
export async function POST() {
  try {
    const user = await requireAuth();

    const creds = await getActiveFreemiusCreds();
    if (!creds) {
      return NextResponse.json(
        { error: "No active Freemius configuration. Add one in Settings → Freemius." },
        { status: 400 }
      );
    }

    const products = await listProducts(creds);

    let created = 0;
    let skipped = 0;
    let invalid = 0;
    const createdSequences: { id: number; name: string }[] = [];

    for (const p of products) {
      const id = Number(p.id);
      if (!Number.isInteger(id) || id <= 0) {
        invalid++;
        continue;
      }
      const existing = await prisma.emailSequence.findUnique({ where: { id }, select: { id: true } });
      if (existing) {
        skipped++;
        continue;
      }
      // Explicit id = Freemius product id (overrides the autoincrement default).
      await prisma.emailSequence.create({
        data: { id, name: p.title || `Product ${id}`, createdBy: user.id },
      });
      created++;
      createdSequences.push({ id, name: p.title });
    }

    // Keep the autoincrement counter ahead of the highest explicit id so future
    // "New Sequence" creates don't collide with an imported product id.
    if (created > 0) {
      try {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"EmailSequence"', 'id'), (SELECT MAX(id) FROM "EmailSequence"))`
        );
      } catch {
        /* best-effort; explicit-id inserts already succeeded */
      }
    }

    return NextResponse.json({
      success: true,
      total: products.length,
      created,
      skipped,
      invalid,
      createdSequences,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
