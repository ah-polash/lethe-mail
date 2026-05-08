import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config();

async function main() {
  const url = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx check-unsub.ts <email> [--reset]");
    process.exit(1);
  }
  const reset = process.argv.includes("--reset");

  if (reset) {
    const a = await prisma.categoryUnsubscribe.deleteMany({ where: { email } });
    const b = await prisma.campaignEvent.deleteMany({
      where: { email, eventType: "unsubscribed" },
    });
    console.log(`Reset ${email}: removed ${a.count} category rows, ${b.count} unsubscribed events.`);
    await prisma.$disconnect();
    return;
  }

  const opts = await prisma.categoryUnsubscribe.findMany({
    where: { email },
    include: { category: { select: { name: true, autoCheckOnUnsubscribe: true } } },
  });
  const events = await prisma.campaignEvent.findMany({
    where: { email, eventType: "unsubscribed" },
    select: { id: true, campaignId: true, metadata: true, createdAt: true },
  });
  console.log("CategoryUnsubscribe:", JSON.stringify(opts, null, 2));
  console.log("UnsubscribeEvents:", JSON.stringify(events, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
