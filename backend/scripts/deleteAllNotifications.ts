/**
 * DANGER: Deletes ALL notifications from the database.
 *
 * P2: Added environment guard — this script will refuse to run in production
 * unless explicitly forced with FORCE_DESTRUCTIVE=true.
 *
 * Usage:
 *   npx tsx scripts/deleteAllNotifications.ts              # dev/staging only
 *   FORCE_DESTRUCTIVE=true npx tsx scripts/deleteAllNotifications.ts  # any env
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const forceDestructive = process.env.FORCE_DESTRUCTIVE === "true";

  if (nodeEnv === "production" && !forceDestructive) {
    console.error(
      `Refusing to run in production (NODE_ENV=${nodeEnv}). ` +
      `Set FORCE_DESTRUCTIVE=true to override.`
    );
    process.exit(1);
  }

  console.warn(`Running in ${nodeEnv} environment. This will delete ALL notifications.`);

  const result = await prisma.notification.deleteMany({});
  console.log(`Deleted ${result.count} notifications`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
