import "dotenv/config";

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@core.local";
  const adminPhone = process.env.ADMIN_PHONE ?? "+8801700000000";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@12345";

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ email: adminEmail }, { phone: adminPhone }]
    }
  });

  if (existingAdmin) {
    console.log("Admin seed skipped: admin already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.create({
    data: {
      fullName: process.env.ADMIN_NAME ?? "CORE Admin",
      email: adminEmail,
      phone: adminPhone,
      passwordHash,
      location: process.env.ADMIN_LOCATION ?? "Dhaka",
      role: Role.ADMIN,
      skills: []
    }
  });

  console.log("Admin seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
