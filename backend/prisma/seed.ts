import "dotenv/config";

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ==================== Seed Admin ====================
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
  } else {
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

  // ==================== Seed Demo Users ====================
  console.log("Seeding demo users...");

  const demoPassword = await bcrypt.hash("Demo@1234", 12);

  const user1 = await prisma.user.upsert({
    where: { email: "user1@demo.local" },
    update: {},
    create: {
      fullName: "Ahmed Rahman",
      email: "user1@demo.local",
      phone: "+8801712345601",
      passwordHash: demoPassword,
      location: "Mirpur, Dhaka",
      role: Role.USER,
      skills: [],
      avatarUrl: "https://i.pravatar.cc/150?u=user1"
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: "user2@demo.local" },
    update: {},
    create: {
      fullName: "Fatima Khan",
      email: "user2@demo.local",
      phone: "+8801712345602",
      passwordHash: demoPassword,
      location: "Gulshan, Dhaka",
      role: Role.USER,
      skills: [],
      avatarUrl: "https://i.pravatar.cc/150?u=user2"
    }
  });

  const volunteer1 = await prisma.user.upsert({
    where: { email: "volunteer1@demo.local" },
    update: {},
    create: {
      fullName: "Karim Hassan",
      email: "volunteer1@demo.local",
      phone: "+8801712345603",
      passwordHash: demoPassword,
      location: "Banani, Dhaka",
      role: Role.VOLUNTEER,
      skills: ["First Aid", "Search & Rescue"],
      availability: "Weekends",
      certifications: "Red Cross First Aid Certified",
      avatarUrl: "https://i.pravatar.cc/150?u=volunteer1"
    }
  });

  console.log(`Demo users seeded: ${user1.email}, ${user2.email}, ${volunteer1.email}`);

  // ==================== Seed Demo Resources ====================
  console.log("Seeding demo resources...");

  const resources = [
    {
      name: "Emergency Medical Kit",
      category: "Medical Supplies",
      quantity: 15,
      unit: "pieces",
      condition: "New",
      address: "Road 12, House 34, Banani, Dhaka",
      latitude: 23.7937,
      longitude: 90.4066,
      contactPreference: "Phone",
      notes: "Contains bandages, antiseptics, pain relievers, and basic first aid supplies",
      userId: volunteer1.id
    },
    {
      name: "Drinking Water Bottles",
      category: "Food & Water",
      quantity: 100,
      unit: "pieces",
      condition: "New",
      address: "Road 5, House 10, Gulshan-1, Dhaka",
      latitude: 23.7808,
      longitude: 90.4167,
      contactPreference: "SMS",
      notes: "1-liter sealed bottles, suitable for emergency distribution",
      userId: user1.id
    },
    {
      name: "Rice Bags (10kg each)",
      category: "Food & Water",
      quantity: 25,
      unit: "pieces",
      condition: "New",
      address: "Block A, Flat 5B, Mirpur DOHS, Dhaka",
      latitude: 23.8103,
      longitude: 90.4125,
      contactPreference: "Phone",
      notes: "Premium quality rice, sealed packaging",
      userId: user2.id
    },
    {
      name: "Winter Blankets",
      category: "Clothing",
      quantity: 50,
      unit: "pieces",
      condition: "Good",
      address: "Road 27, House 89, Dhanmondi, Dhaka",
      latitude: 23.7461,
      longitude: 90.3742,
      contactPreference: "In-App",
      notes: "Warm woolen blankets, cleaned and sanitized",
      userId: user1.id
    },
    {
      name: "Tents (Family Size)",
      category: "Shelter",
      quantity: 8,
      unit: "pieces",
      condition: "Good",
      address: "House 45, Road 9, Baridhara, Dhaka",
      latitude: 23.7925,
      longitude: 90.4101,
      contactPreference: "Phone",
      notes: "4-person capacity, waterproof, includes stakes and ropes",
      userId: volunteer1.id
    },
    {
      name: "Portable Generator (5kW)",
      category: "Tools & Equipment",
      quantity: 2,
      unit: "pieces",
      condition: "Good",
      address: "Road 112, House 23, Bashundhara R/A, Dhaka",
      latitude: 23.8167,
      longitude: 90.4303,
      contactPreference: "Phone",
      notes: "Fuel-efficient, suitable for emergency power supply",
      userId: user2.id
    },
    {
      name: "Ambulance Van",
      category: "Transportation",
      quantity: 1,
      unit: "units",
      condition: "Good",
      address: "Central Mosque Road, Mohammadpur, Dhaka",
      latitude: 23.7644,
      longitude: 90.3628,
      contactPreference: "Phone",
      notes: "Equipped with stretcher and basic medical equipment, driver available",
      userId: volunteer1.id
    },
    {
      name: "Baby Formula & Diapers",
      category: "Medical Supplies",
      quantity: 40,
      unit: "packs",
      condition: "New",
      address: "Road 3, House 7, Uttara Sector 7, Dhaka",
      latitude: 23.8759,
      longitude: 90.3795,
      contactPreference: "SMS",
      notes: "Various sizes, unopened packages",
      userId: user1.id
    },
    {
      name: "Flashlights & Batteries",
      category: "Tools & Equipment",
      quantity: 60,
      unit: "pieces",
      condition: "New",
      address: "House 67, Road 15, Niketan, Dhaka",
      latitude: 23.7833,
      longitude: 90.4167,
      contactPreference: "In-App",
      notes: "LED flashlights with extra battery packs",
      userId: user2.id
    },
    {
      name: "Cooking Utensils Set",
      category: "Other",
      quantity: 12,
      unit: "sets",
      condition: "Good",
      address: "Road 8, House 21, Lalmatia, Dhaka",
      latitude: 23.7588,
      longitude: 90.3705,
      contactPreference: "Phone",
      notes: "Includes pots, pans, plates, and utensils for 10 people",
      userId: user1.id
    }
  ];

  let createdCount = 0;
  for (const resourceData of resources) {
    const existing = await prisma.resource.findFirst({
      where: { name: resourceData.name }
    });

    if (!existing) {
      await prisma.resource.create({
        data: resourceData
      });
      createdCount++;
    }
  }

  console.log(`Created ${createdCount} demo resources.`);

  // ==================== Summary ====================
  console.log("\n=== Seed Complete ===");
  console.log("\nDemo Credentials:");
  console.log("  Admin:      admin@core.local / Admin@12345");
  console.log("  User 1:     user1@demo.local / Demo@1234");
  console.log("  User 2:     user2@demo.local / Demo@1234");
  console.log("  Volunteer:  volunteer1@demo.local / Demo@1234");
  console.log("\nResources seeded:", createdCount);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
