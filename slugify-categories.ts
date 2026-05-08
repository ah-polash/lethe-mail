import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config();

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // 1) Add slug column if missing (nullable so existing rows don't blow up)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "CampaignCategory" ADD COLUMN IF NOT EXISTS "slug" TEXT`
  );

  // 2) Backfill any rows that don't have a slug yet, ensuring uniqueness
  const rows = await prisma.$queryRawUnsafe<{ id: string; name: string; slug: string | null }[]>(
    `SELECT id, name, slug FROM "CampaignCategory"`
  );
  const used = new Set(rows.map((r) => r.slug).filter(Boolean) as string[]);
  for (const r of rows) {
    if (r.slug) continue;
    const base = slugify(r.name) || "category";
    let candidate = base;
    let n = 1;
    while (used.has(candidate)) candidate = `${base}-${++n}`;
    used.add(candidate);
    await prisma.$executeRawUnsafe(
      `UPDATE "CampaignCategory" SET "slug" = $1 WHERE id = $2`,
      candidate,
      r.id
    );
    console.log(`Backfilled ${r.name} -> ${candidate}`);
  }

  // 3) Lock down: NOT NULL + unique index
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "CampaignCategory" ALTER COLUMN "slug" SET NOT NULL`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "CampaignCategory_slug_key" ON "CampaignCategory"("slug")`
  );

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
