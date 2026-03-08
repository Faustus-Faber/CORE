import "dotenv/config";

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Secure Documentation test data...\n");

  // Create test users
  const testPassword = await bcrypt.hash("User@12345", 12);

  const [user1, user2, user3] = await Promise.all([
    prisma.user.upsert({
      where: { email: "farhan@test.com" },
      update: {},
      create: {
        fullName: "Farhan Zarif",
        email: "farhan@test.com",
        phone: "+8801711111111",
        passwordHash: testPassword,
        location: "Mohakhali, Dhaka",
        role: Role.USER,
        skills: []
      }
    }),
    prisma.user.upsert({
      where: { email: "ishaq@test.com" },
      update: {},
      create: {
        fullName: "Ishaq Ahnaf Khan",
        email: "ishaq@test.com",
        phone: "+8801722222222",
        passwordHash: testPassword,
        location: "Banani, Dhaka",
        role: Role.VOLUNTEER,
        skills: ["First Aid", "Search & Rescue"],
        availability: "Weekends",
        certifications: "Basic Life Support"
      }
    }),
    prisma.user.upsert({
      where: { email: "alve@test.com" },
      update: {},
      create: {
        fullName: "Al Irfan Alve",
        email: "alve@test.com",
        phone: "+8801733333333",
        passwordHash: testPassword,
        location: "Gulshan, Dhaka",
        role: Role.USER,
        skills: []
      }
    })
  ]);

  console.log(`✅ Created/updated test users:`);
  console.log(`   - ${user1.fullName} (${user1.email})`);
  console.log(`   - ${user2.fullName} (${user2.email})`);
  console.log(`   - ${user3.fullName} (${user3.email})\n`);

  // Create secure folders for user1 (Farhan)
  const folder1 = await prisma.secureFolder.create({
    data: {
      name: "Mohakhali Flood Evidence - Dec 2025",
      description: "Photos and notes from flood rescue operations in Mohakhali area",
      ownerId: user1.id
    }
  });

  const folder2 = await prisma.secureFolder.create({
    data: {
      name: "Building Collapse Documentation",
      description: "Evidence from building collapse incident - contains photos of structural damage and rescue notes",
      ownerId: user1.id
    }
  });

  console.log(`✅ Created secure folders for Farhan:`);
  console.log(`   - ${folder1.name}`);
  console.log(`   - ${folder2.name}\n`);

  // Create sample files for folder1
  const file1 = await prisma.folderFile.create({
    data: {
      folderId: folder1.id,
      uploaderId: user1.id,
      fileUrl: "/uploads/sample_flood1.jpg",
      fileType: "image/jpeg",
      sizeBytes: 2458624,
      gpsLat: 23.7808,
      gpsLng: 90.4140
    }
  });

  const file2 = await prisma.folderFile.create({
    data: {
      folderId: folder1.id,
      uploaderId: user1.id,
      fileUrl: "/uploads/sample_flood2.jpg",
      fileType: "image/jpeg",
      sizeBytes: 3145728,
      gpsLat: 23.7815,
      gpsLng: 90.4155
    }
  });

  const file3 = await prisma.folderFile.create({
    data: {
      folderId: folder1.id,
      uploaderId: user1.id,
      fileUrl: "/uploads/sample_rescue.mp4",
      fileType: "video/mp4",
      sizeBytes: 15728640,
      gpsLat: 23.7820,
      gpsLng: 90.4160
    }
  });

  console.log(`✅ Created sample files for folder1: ${file1.fileUrl}, ${file2.fileUrl}, ${file3.fileUrl}\n`);

  // Create sample notes for folder1
  const note1 = await prisma.folderNote.create({
    data: {
      folderId: folder1.id,
      authorId: user1.id,
      content: "Rescued 3 families from Building 7. Water level reached 6 feet. Used inflatable boats for evacuation. No casualties reported. Local volunteers helped with coordination.",
      gpsLat: 23.7808,
      gpsLng: 90.4140
    }
  });

  const note2 = await prisma.folderNote.create({
    data: {
      folderId: folder1.id,
      authorId: user1.id,
      content: "Emergency supplies distributed: 50kg rice, 30kg lentils, 20 bottles water, 15 blankets. Priority given to families with children and elderly.",
      gpsLat: 23.7815,
      gpsLng: 90.4155
    }
  });

  console.log(`✅ Created sample notes for folder1: ${note1.content.substring(0, 50)}...`);
  console.log(`   ${note2.content.substring(0, 50)}...\n`);

  // Create sample notes for folder2
  const note3 = await prisma.folderNote.create({
    data: {
      folderId: folder2.id,
      authorId: user1.id,
      content: "Initial assessment: 5-story building partially collapsed. Estimated 20-30 people trapped. Fire service and civil defense on site. Heavy equipment requested for debris removal.",
      gpsLat: 23.7900,
      gpsLng: 90.4200
    }
  });

  console.log(`✅ Created sample note for folder2: ${note3.content.substring(0, 50)}...\n`);

  // Create share link for folder1 (for testing sharing feature)
  const shareLink = await prisma.shareLink.create({
    data: {
      folderId: folder1.id,
      token: "test_share_token_abc123xyz789",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }
  });

  console.log(`✅ Created share link for folder1 (expires in 24h)`);
  console.log(`   Token: ${shareLink.token}\n`);

  // Create folders for user2 (Ishaq)
  const folder3 = await prisma.secureFolder.create({
    data: {
      name: "Volunteer Training Documentation",
      description: "Training session photos and operational notes from volunteer drills",
      ownerId: user2.id
    }
  });

  const folder4 = await prisma.secureFolder.create({
    data: {
      name: "Medical Camp Records",
      description: "Free medical camp documentation - patient photos (consent obtained) and supply inventory",
      ownerId: user2.id
    }
  });

  console.log(`✅ Created secure folders for Ishaq:`);
  console.log(`   - ${folder3.name}`);
  console.log(`   - ${folder4.name}\n`);

  // Create sample files for folder3
  await prisma.folderFile.create({
    data: {
      folderId: folder3.id,
      uploaderId: user2.id,
      fileUrl: "/uploads/sample_training1.jpg",
      fileType: "image/jpeg",
      sizeBytes: 1843200,
      gpsLat: 23.7950,
      gpsLng: 90.4250
    }
  });

  await prisma.folderFile.create({
    data: {
      folderId: folder3.id,
      uploaderId: user2.id,
      fileUrl: "/uploads/sample_training2.jpg",
      fileType: "image/jpeg",
      sizeBytes: 2097152,
      gpsLat: 23.7955,
      gpsLng: 90.4255
    }
  });

  console.log(`✅ Created sample files for folder3\n`);

  // Create sample notes for folder3
  await prisma.folderNote.create({
    data: {
      folderId: folder3.id,
      authorId: user2.id,
      content: "Training session completed: CPR certification, water rescue techniques, first aid basics. 15 volunteers participated. Duration: 6 hours.",
      gpsLat: 23.7950,
      gpsLng: 90.4250
    }
  });

  console.log(`✅ Created sample note for folder3\n`);

  // Create folder for user3 (Alve)
  const folder5 = await prisma.secureFolder.create({
    data: {
      name: "Resource Distribution Records",
      description: "Documentation of emergency resource distribution in affected areas",
      ownerId: user3.id
    }
  });

  console.log(`✅ Created secure folder for Alve:`);
  console.log(`   - ${folder5.name}\n`);

  // Create sample files for folder5
  await prisma.folderFile.create({
    data: {
      folderId: folder5.id,
      uploaderId: user3.id,
      fileUrl: "/uploads/sample_distribution1.jpg",
      fileType: "image/jpeg",
      sizeBytes: 2621440,
      gpsLat: 23.8000,
      gpsLng: 90.4300
    }
  });

  console.log(`✅ Created sample files for folder5\n`);

  // Create sample notes for folder5
  await prisma.folderNote.create({
    data: {
      folderId: folder5.id,
      authorId: user3.id,
      content: "Distributed supplies to 45 families: rice (5kg/family), lentils (2kg), cooking oil (1L), salt (500g), sugar (1kg). Total beneficiaries: 225 individuals.",
      gpsLat: 23.8000,
      gpsLng: 90.4300
    }
  });

  console.log(`✅ Created sample note for folder5\n`);

  // Summary
  const folderCount = await prisma.secureFolder.count();
  const fileCount = await prisma.folderFile.count();
  const noteCount = await prisma.folderNote.count();
  const shareLinkCount = await prisma.shareLink.count();

  console.log("📊 Seeding Summary:");
  console.log(`   Total Users: 3`);
  console.log(`   Total Secure Folders: ${folderCount}`);
  console.log(`   Total Files: ${fileCount}`);
  console.log(`   Total Notes: ${noteCount}`);
  console.log(`   Total Share Links: ${shareLinkCount}`);
  console.log("\n✅ Secure Documentation seeding complete!\n");
  console.log("📝 Test Credentials (all users):");
  console.log("   Password: User@12345");
  console.log("   Emails: farhan@test.com, ishaq@test.com, alve@test.com\n");
}

main()
  .catch((error) => {
    console.error("❌ Seeding error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
