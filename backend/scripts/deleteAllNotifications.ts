import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.notification.deleteMany({});
  console.log(`Deleted ${result.count} notifications`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());