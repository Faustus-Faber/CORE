import "dotenv/config";

import {
  PrismaClient,
  Role,
  InteractionContext,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  CrisisEventStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FRAUD_KEYWORDS = [
  "scam", "fake", "fraud", "not present", "took supplies",
  "stole", "liar", "dishonest", "corrupt", "bribe"
];

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function checkAndFlagVolunteer(volunteerId: string) {
  const reviews = await prisma.review.findMany({
    where: { volunteerId },
    select: { rating: true, text: true, wouldWorkAgain: true, createdAt: true }
  });

  const reasons: string[] = [];
  const total = reviews.length;

  if (total >= 5) {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / total;
    if (avg < 2.0) {
      reasons.push(`Average rating below 2.0 (${avg.toFixed(2)} stars across ${total} reviews)`);
    }
  }

  if (total >= 3) {
    const fraudCount = reviews.filter(r =>
      FRAUD_KEYWORDS.some(kw => r.text.toLowerCase().includes(kw))
    ).length;
    const pct = (fraudCount / total) * 100;
    if (pct >= 40) {
      reasons.push(`${pct.toFixed(0)}% of reviews contain fraud indicators`);
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentNeg = reviews.filter(r => !r.wouldWorkAgain && r.createdAt >= thirtyDaysAgo).length;
  if (recentNeg >= 3) {
    reasons.push(`${recentNeg} "Would not work again" responses in 30 days`);
  }

  await prisma.user.update({
    where: { id: volunteerId },
    data: { isFlagged: reasons.length > 0, volunteerFlagReasons: reasons }
  });
}

// ═══════════════════════════════════════════════════════════════
// DATA POOLS — Bangladesh
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("══════════════════════════════════════════════════════════");
  console.log("  CORE Platform — Bangladesh Production-Scale Seed");
  console.log("══════════════════════════════════════════════════════════\n");

  console.log("Clearing all existing data...");
  await prisma.shareLink.deleteMany();
  await prisma.folderNote.deleteMany();
  await prisma.folderFile.deleteMany();
  await prisma.secureFolder.deleteMany();
  await prisma.crisisEventReport.deleteMany();
  await prisma.crisisEvent.deleteMany();
  await prisma.review.deleteMany();
  await prisma.incidentReport.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.user.deleteMany();
  console.log("  Done.\n");

  // ═══════════════════════════════════════════════════════════════
  // 1. USERS — 2 admins + 35 regular users + 12 volunteers
  // ═══════════════════════════════════════════════════════════════
  console.log("Creating users...");
  const adminPw = await hashPassword(process.env.ADMIN_PASSWORD ?? "Admin@12345");
  const userPw = await hashPassword("User@12345");
  const volPw = await hashPassword("Volunteer@12345");

  let phoneSeq = 1;
  function nextPhone() {
    return `+88017${String(phoneSeq++).padStart(8, "0")}`;
  }

  await prisma.user.create({
    data: {
      fullName: process.env.ADMIN_NAME ?? "CORE Admin",
      email: process.env.ADMIN_EMAIL ?? "admin@core.local",
      phone: process.env.ADMIN_PHONE ?? "+8801700000000",
      passwordHash: adminPw,
      location: "CORE Headquarters, Dhaka",
      latitude: 23.8103,
      longitude: 90.4125,
      role: Role.ADMIN,
      skills: [],
      createdAt: daysAgo(365)
    }
  });
  phoneSeq = 2;

  await prisma.user.create({
    data: {
      fullName: "Mizanur Rahman",
      email: "mizan@core.local",
      phone: nextPhone(),
      passwordHash: adminPw,
      location: "Gulshan-2, Dhaka",
      latitude: 23.7948,
      longitude: 90.4143,
      role: Role.ADMIN,
      skills: [],
      createdAt: daysAgo(200)
    }
  });

  const userData: Array<{
    fullName: string; email: string; location: string;
    lat: number; lng: number; createdDaysAgo: number;
  }> = [
    { fullName: "Farhan Zarif", email: "farhan@core.local", location: "Mohakhali, Dhaka", lat: 23.7785, lng: 90.4065, createdDaysAgo: 180 },
    { fullName: "Rahim Uddin", email: "rahim@core.local", location: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, createdDaysAgo: 150 },
    { fullName: "Karim Hossain", email: "karim@core.local", location: "Uttara Sector-7, Dhaka", lat: 23.8759, lng: 90.3795, createdDaysAgo: 140 },
    { fullName: "Nasreen Akter", email: "nasreen@core.local", location: "Dhanmondi-27, Dhaka", lat: 23.7466, lng: 90.3736, createdDaysAgo: 130 },
    { fullName: "Jamal Ahmed", email: "jamal@core.local", location: "Gulshan-1, Dhaka", lat: 23.7808, lng: 90.4167, createdDaysAgo: 120 },
    { fullName: "Sumaiya Rahman", email: "sumaiya@core.local", location: "Tejgaon, Dhaka", lat: 23.7583, lng: 90.3928, createdDaysAgo: 110 },
    { fullName: "Arif Khan", email: "arif@core.local", location: "Sadarghat, Old Dhaka", lat: 23.7080, lng: 90.4050, createdDaysAgo: 100 },
    { fullName: "Fatema Begum", email: "fatema@core.local", location: "Farmgate, Dhaka", lat: 23.7570, lng: 90.3876, createdDaysAgo: 95 },
    { fullName: "Rafiq Islam", email: "rafiq@core.local", location: "Motijheel, Dhaka", lat: 23.7330, lng: 90.4172, createdDaysAgo: 90 },
    { fullName: "Salma Khatun", email: "salma@core.local", location: "Rampura, Dhaka", lat: 23.7635, lng: 90.4251, createdDaysAgo: 85 },
    { fullName: "Mahbubur Rahman", email: "mahbub@core.local", location: "Bashundhara R/A, Dhaka", lat: 23.8167, lng: 90.4303, createdDaysAgo: 80 },
    { fullName: "Nusrat Jahan", email: "nusrat@core.local", location: "Banani, Dhaka", lat: 23.7937, lng: 90.4066, createdDaysAgo: 75 },
    { fullName: "Imran Hossain", email: "imran@core.local", location: "Badda, Dhaka", lat: 23.7803, lng: 90.4260, createdDaysAgo: 70 },
    { fullName: "Tahmina Sultana", email: "tahmina@core.local", location: "Mohammadpur, Dhaka", lat: 23.7662, lng: 90.3589, createdDaysAgo: 65 },
    { fullName: "Shakil Sarker", email: "shakil@core.local", location: "Mirpur-12, Dhaka", lat: 23.8219, lng: 90.3654, createdDaysAgo: 60 },
    { fullName: "Ruma Akter", email: "ruma@core.local", location: "Jatrabari, Dhaka", lat: 23.7100, lng: 90.4316, createdDaysAgo: 55 },
    { fullName: "Shohag Mia", email: "shohag@core.local", location: "Keraniganj, Dhaka", lat: 23.6983, lng: 90.3460, createdDaysAgo: 50 },
    { fullName: "Hasina Parvin", email: "hasina@core.local", location: "Narayanganj Shiddhhirganj", lat: 23.6850, lng: 90.4960, createdDaysAgo: 48 },
    { fullName: "Mithun Das", email: "mithun@core.local", location: "Gazipur Chowrasta", lat: 24.0000, lng: 90.4200, createdDaysAgo: 45 },
    { fullName: "Nabila Ferdous", email: "nabila@core.local", location: "Savar, Dhaka", lat: 23.8460, lng: 90.2566, createdDaysAgo: 42 },
    { fullName: "Polash Chowdhury", email: "polash@core.local", location: "Agrabad, Chattogram", lat: 22.3267, lng: 91.8127, createdDaysAgo: 40 },
    { fullName: "Sharmin Sultana", email: "sharmin@core.local", location: "Nasirabad, Chattogram", lat: 22.3656, lng: 91.8295, createdDaysAgo: 38 },
    { fullName: "Tanvir Hasan", email: "tanvir@core.local", location: "Zindabazar, Sylhet", lat: 24.8949, lng: 91.8687, createdDaysAgo: 35 },
    { fullName: "Moushumi Akter", email: "moushumi@core.local", location: "Rajshahi Court Area", lat: 24.3745, lng: 88.6042, createdDaysAgo: 30 },
    { fullName: "Saiful Alam", email: "saiful@core.local", location: "Khulna Shibbari More", lat: 22.8456, lng: 89.5403, createdDaysAgo: 28 },
    { fullName: "Laizu Begum", email: "laizu@core.local", location: "Barisal Sadar", lat: 22.7010, lng: 90.3535, createdDaysAgo: 25 },
    { fullName: "Faruk Ahmed", email: "faruk@core.local", location: "Rangpur Town Hall", lat: 25.7439, lng: 89.2752, createdDaysAgo: 22 },
    { fullName: "Meherun Nessa", email: "meherun@core.local", location: "Comilla Kandirpar", lat: 23.4607, lng: 91.1809, createdDaysAgo: 20 },
    { fullName: "Abul Kalam", email: "kalam@core.local", location: "Cox's Bazar Kolatoli", lat: 21.4272, lng: 92.0058, createdDaysAgo: 18 },
    { fullName: "Shamima Nasrin", email: "shamima@core.local", location: "Mymensingh Town", lat: 24.7471, lng: 90.4203, createdDaysAgo: 15 },
    { fullName: "Zahid Hasan", email: "zahid@core.local", location: "Shahbag, Dhaka", lat: 23.7381, lng: 90.3953, createdDaysAgo: 12 },
    { fullName: "Israt Jahan", email: "israt@core.local", location: "Lalbagh, Old Dhaka", lat: 23.7190, lng: 90.3890, createdDaysAgo: 10 },
    { fullName: "Monir Hossain", email: "monir@core.local", location: "Tongi, Gazipur", lat: 23.9300, lng: 90.4010, createdDaysAgo: 7 },
    { fullName: "Rojina Akter", email: "rojina@core.local", location: "Hatirjheel, Dhaka", lat: 23.7733, lng: 90.4150, createdDaysAgo: 3 },
    { fullName: "Babul Mia", email: "babul@core.local", location: "Dhanmondi-15, Dhaka", lat: 23.7416, lng: 90.3760, createdDaysAgo: 0 },
  ];

  const users: Record<string, Awaited<ReturnType<typeof prisma.user.create>>> = {};
  for (const u of userData) {
    users[u.email.split("@")[0]] = await prisma.user.create({
      data: {
        fullName: u.fullName,
        email: u.email,
        phone: nextPhone(),
        passwordHash: userPw,
        location: u.location,
        latitude: u.lat,
        longitude: u.lng,
        role: Role.USER,
        skills: [],
        createdAt: daysAgo(u.createdDaysAgo)
      }
    });
  }

  console.log(`  ${userData.length} regular users created`);

  const volunteerData: Array<{
    fullName: string; email: string; location: string;
    lat: number; lng: number; skills: string[];
    availability: string; certifications: string; createdDaysAgo: number;
  }> = [
    { fullName: "Ayesha Siddiqua", email: "ayesha.vol@core.local", location: "Banani, Dhaka", lat: 23.7937, lng: 90.4066, skills: ["First Aid", "Search & Rescue", "CPR Certified"], availability: "Weekends", certifications: "Red Cross First Aid, Emergency Response Level 2", createdDaysAgo: 300 },
    { fullName: "Kamrul Islam", email: "kamrul.vol@core.local", location: "Mirpur-1, Dhaka", lat: 23.7956, lng: 90.3537, skills: ["Medical Aid", "Counseling", "Trauma Support"], availability: "Part-time evenings", certifications: "Basic Life Support, Mental Health First Aid", createdDaysAgo: 250 },
    { fullName: "Rashida Begum", email: "rashida.vol@core.local", location: "Dhanmondi-27, Dhaka", lat: 23.7466, lng: 90.3736, skills: ["Shelter Management", "Food Distribution", "Child Care"], availability: "Full-time", certifications: "Disaster Management Level 2, Child Protection", createdDaysAgo: 200 },
    { fullName: "Harun-or-Rashid", email: "harun.vol@core.local", location: "Uttara Sector-3, Dhaka", lat: 23.8614, lng: 90.3896, skills: ["Supply Distribution", "Logistics", "Driving"], availability: "Full-time", certifications: "Heavy Vehicle License, Warehouse Management", createdDaysAgo: 180 },
    { fullName: "Farzana Alam", email: "farzana.vol@core.local", location: "Gulshan-2, Dhaka", lat: 23.7948, lng: 90.4143, skills: ["Medical Aid", "First Aid", "Nursing"], availability: "On-call", certifications: "Registered Nurse, Advanced Cardiac Life Support", createdDaysAgo: 160 },
    { fullName: "Masud Rana", email: "masud.vol@core.local", location: "Pahartali, Chattogram", lat: 22.3480, lng: 91.7635, skills: ["Search & Rescue", "Water Rescue", "Boat Handling"], availability: "Full-time", certifications: "Swift Water Rescue Technician, Boat Operator", createdDaysAgo: 140 },
    { fullName: "Shirin Akter", email: "shirin.vol@core.local", location: "Zindabazar, Sylhet", lat: 24.8949, lng: 91.8687, skills: ["Medical Aid", "Community Health"], availability: "Weekdays", certifications: "Community Health Worker", createdDaysAgo: 120 },
    { fullName: "Billal Hossain", email: "billal.vol@core.local", location: "Khulna Shibbari More", lat: 22.8456, lng: 89.5403, skills: ["Supply Distribution", "Construction"], availability: "Part-time", certifications: "None", createdDaysAgo: 100 },
    { fullName: "Tania Sultana", email: "tania.vol@core.local", location: "Rajshahi Court Area", lat: 24.3745, lng: 88.6042, skills: ["Counseling", "Teaching", "First Aid"], availability: "Weekends", certifications: "Psychology degree, Basic First Aid", createdDaysAgo: 80 },
    { fullName: "Alamgir Kabir", email: "alamgir.vol@core.local", location: "Barisal Sadar", lat: 22.7010, lng: 90.3535, skills: ["Boat Handling", "Fishing", "Water Rescue"], availability: "Full-time", certifications: "Boat Operator License", createdDaysAgo: 60 },
    { fullName: "Sohel Rana", email: "sohel.vol@core.local", location: "Narayanganj Shiddhhirganj", lat: 23.6850, lng: 90.4960, skills: ["Supply Distribution"], availability: "Part-time", certifications: "None", createdDaysAgo: 40 },
    { fullName: "Munira Khatun", email: "munira.vol@core.local", location: "Cox's Bazar Kolatoli", lat: 21.4272, lng: 92.0058, skills: ["Shelter Management", "Cooking", "Child Care"], availability: "Full-time", certifications: "Disaster Shelter Management", createdDaysAgo: 20 },
  ];

  const volunteers: Record<string, Awaited<ReturnType<typeof prisma.user.create>>> = {};
  for (const v of volunteerData) {
    const key = v.email.split("@")[0].replace(".vol", "");
    volunteers[key] = await prisma.user.create({
      data: {
        fullName: v.fullName,
        email: v.email,
        phone: nextPhone(),
        passwordHash: volPw,
        location: v.location,
        latitude: v.lat,
        longitude: v.lng,
        role: Role.VOLUNTEER,
        skills: v.skills,
        availability: v.availability,
        certifications: v.certifications,
        createdAt: daysAgo(v.createdDaysAgo)
      }
    });
  }

  console.log(`  ${volunteerData.length} volunteers created`);
  console.log("  2 admins created\n");

  // ═══════════════════════════════════════════════════════════════
  // 2. INCIDENT REPORTS — 50 reports
  // ═══════════════════════════════════════════════════════════════
  console.log("Creating incident reports...");

  const reportDefs: Array<{
    reporter: string; title: string; description: string;
    type: IncidentType; loc: string; lat: number; lng: number;
    cred: number; severity: IncidentSeverity;
    classType: IncidentType; classTitle: string;
    spam: boolean; status: IncidentStatus; ago: Date;
    voice?: { audio: string; lang: string; langProb: number; translated: string };
  }> = [
    // ── FLOOD reports (monsoon season) ──
    { reporter: "farhan", title: "মিরপুর-১০ এ ভয়াবহ বন্যা", description: "ভারী বৃষ্টিতে মিরপুর সেকশন ১০-১২ এ ব্যাপক বন্যা। পানি ৫ ফুটের উপরে উঠেছে। ছাদে আটকা পড়েছে অনেক পরিবার। জরুরি নৌকা উদ্ধার প্রয়োজন।", type: IncidentType.FLOOD, loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, cred: 95, severity: IncidentSeverity.CRITICAL, classType: IncidentType.FLOOD, classTitle: "Severe Monsoon Flooding Traps Families in Mirpur-10", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(6), voice: { audio: "/uploads/voice/mirpur_flood_bn.webm", lang: "bn", langProb: 0.97, translated: "Severe flooding in Mirpur sections 10-12 due to heavy rain. Water has risen above 5 feet. Many families are stranded on rooftops. Emergency boat rescue needed." } },
    { reporter: "rahim", title: "Waterlogging Near Mirpur Mazar Road", description: "Streets completely submerged near Mirpur Mazar Road. Vehicles stuck. Pedestrians wading through waist-deep water. Sewage overflow making conditions hazardous. Children unable to reach school.", type: IncidentType.FLOOD, loc: "Mirpur Mazar Road, Dhaka", lat: 23.8085, lng: 90.3695, cred: 88, severity: IncidentSeverity.HIGH, classType: IncidentType.FLOOD, classTitle: "Severe Waterlogging Paralyzes Mirpur Mazar Road", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(5) },
    { reporter: "shakil", title: "Mirpur-12 er Boshti te Pani Dhukeche", description: "Mirpur-12 bosti area te pani dhukche. Ghorey ghorey pani, bacchader niye manus chader upor uthche. Khabar nai, pani nai.", type: IncidentType.FLOOD, loc: "Mirpur-12, Dhaka", lat: 23.8219, lng: 90.3654, cred: 82, severity: IncidentSeverity.HIGH, classType: IncidentType.FLOOD, classTitle: "Slum Flooding Displaces Residents in Mirpur-12", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(4), voice: { audio: "/uploads/voice/mirpur12_bn.webm", lang: "bn", langProb: 0.94, translated: "Water is entering homes in Mirpur-12 slum area. People are climbing to rooftops with children. No food or clean water available." } },
    { reporter: "saiful", title: "Khulna Riverside Flooding", description: "Rupsha River water level has crossed danger mark. Low-lying areas of Khulna city are inundated. Sonadanga and Daulatpur areas heavily affected. At least 500 families displaced.", type: IncidentType.FLOOD, loc: "Sonadanga, Khulna", lat: 22.8350, lng: 89.5500, cred: 90, severity: IncidentSeverity.CRITICAL, classType: IncidentType.FLOOD, classTitle: "Rupsha River Breaches Danger Level Flooding Khulna", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(10) },
    { reporter: "laizu", title: "Barisal e Jalochchas", description: "Barisal sadar e bonna poristhiti kharap hochhe. Nadi bhenge gache. Ghorey ghorey pani dhukche.", type: IncidentType.FLOOD, loc: "Barisal Sadar", lat: 22.7010, lng: 90.3535, cred: 76, severity: IncidentSeverity.HIGH, classType: IncidentType.FLOOD, classTitle: "River Embankment Breach Causes Flooding in Barisal", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(9), voice: { audio: "/uploads/voice/barisal_flood_bn.webm", lang: "bn", langProb: 0.92, translated: "Flood situation worsening in Barisal Sadar. River embankment has broken. Water entering houses." } },
    { reporter: "tanvir", title: "Sylhet Sunamganj Highway Submerged", description: "Sylhet-Sunamganj highway completely under water. Vehicles stranded for 6+ hours. Flash flood from Meghalaya hills. Army called in for rescue operations.", type: IncidentType.FLOOD, loc: "Sylhet-Sunamganj Highway", lat: 24.9100, lng: 91.8500, cred: 93, severity: IncidentSeverity.CRITICAL, classType: IncidentType.FLOOD, classTitle: "Flash Flood Submerges Sylhet-Sunamganj Highway", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(8) },
    { reporter: "shamima", title: "Mymensingh Brahmaputra Flood Warning", description: "Brahmaputra water level rising dangerously near Mymensingh town. Char areas already flooded. 200+ families evacuated to cyclone shelters. More rain forecast.", type: IncidentType.FLOOD, loc: "Mymensingh Brahmaputra Riverbank", lat: 24.7550, lng: 90.4100, cred: 85, severity: IncidentSeverity.HIGH, classType: IncidentType.FLOOD, classTitle: "Brahmaputra Threatens Mymensingh as Water Levels Rise", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(7) },

    // ── FIRE reports ──
    { reporter: "sumaiya", title: "Tejgaon Chemical Warehouse Fire", description: "Large fire broke out in a chemical warehouse in Tejgaon Industrial Area. Thick black smoke visible from several kilometers. Multiple fire units responding. Adjacent buildings being evacuated.", type: IncidentType.FIRE, loc: "Tejgaon Industrial Area, Dhaka", lat: 23.7583, lng: 90.3928, cred: 91, severity: IncidentSeverity.HIGH, classType: IncidentType.FIRE, classTitle: "Chemical Warehouse Fire Erupts in Tejgaon Industrial Zone", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(12) },
    { reporter: "jamal", title: "Smoke Spreading from Tejgaon Factory", description: "Residents in Tejgaon reporting difficulty breathing due to toxic smoke from ongoing warehouse fire. Schools nearby have sent students home early. Elderly and asthma patients severely affected.", type: IncidentType.FIRE, loc: "Tejgaon, Dhaka", lat: 23.7590, lng: 90.3935, cred: 82, severity: IncidentSeverity.MEDIUM, classType: IncidentType.FIRE, classTitle: "Toxic Smoke Spreads from Tejgaon Warehouse Fire", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(11) },
    { reporter: "polash", title: "Agrabad Garment Factory Fire", description: "Fire broke out on 3rd floor of a 7-story garment factory in Agrabad. Workers evacuated. 2 fire engines on scene. Fire spreading to upper floors. Power cut in surrounding area.", type: IncidentType.FIRE, loc: "Agrabad, Chattogram", lat: 22.3267, lng: 91.8127, cred: 88, severity: IncidentSeverity.HIGH, classType: IncidentType.FIRE, classTitle: "Garment Factory Fire in Agrabad Chattogram", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(14) },
    { reporter: "sharmin", title: "Chattogram Port Area Fire Confirmed", description: "Confirming fire near Agrabad factory. Smoke visible from Nasirabad. Workers from neighboring factories also evacuating. Traffic completely jammed on Agrabad Commercial Road.", type: IncidentType.FIRE, loc: "Nasirabad, Chattogram", lat: 22.3656, lng: 91.8295, cred: 80, severity: IncidentSeverity.MEDIUM, classType: IncidentType.FIRE, classTitle: "Factory Fire Causes Evacuations Across Agrabad Area", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(13) },
    { reporter: "ruma", title: "Slum Fire in Jatrabari", description: "A fire has broken out in a densely packed slum near Jatrabari rail crossing. At least 30 tin-shed homes engulfed. Families fleeing with whatever belongings they can carry. No casualties reported yet.", type: IncidentType.FIRE, loc: "Jatrabari, Dhaka", lat: 23.7100, lng: 90.4316, cred: 87, severity: IncidentSeverity.HIGH, classType: IncidentType.FIRE, classTitle: "Slum Fire Destroys 30 Homes in Jatrabari", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(3) },
    { reporter: "shohag", title: "Keraniganj Plastic Factory Fire", description: "Massive fire at a plastic factory in Keraniganj. Toxic fumes spreading. 3 fire service units battling the blaze. Factory had no fire safety equipment. Adjacent residential buildings at risk.", type: IncidentType.FIRE, loc: "Keraniganj, Dhaka", lat: 23.6983, lng: 90.3460, cred: 84, severity: IncidentSeverity.HIGH, classType: IncidentType.FIRE, classTitle: "Plastic Factory Fire Threatens Keraniganj Neighborhood", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(16) },

    // ── BUILDING COLLAPSE ──
    { reporter: "arif", title: "Sadarghat e Building Dhoshe Geche", description: "চারতলা গার্মেন্টস ফ্যাক্টরি ভবন ধসে পড়েছে সদরঘাট এলাকায়। গতকাল থেকে ফাটল দেখা গিয়েছিল। কমপক্ষে ২০-৩০ জন শ্রমিক ভিতরে আটকা আছে।", type: IncidentType.BUILDING_COLLAPSE, loc: "Sadarghat, Old Dhaka", lat: 23.7080, lng: 90.4050, cred: 97, severity: IncidentSeverity.CRITICAL, classType: IncidentType.BUILDING_COLLAPSE, classTitle: "Garment Factory Collapse Traps Workers in Sadarghat", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(3), voice: { audio: "/uploads/voice/sadarghat_collapse_bn.webm", lang: "bn", langProb: 0.96, translated: "A 4-story garment factory building has collapsed in the Sadarghat area. Cracks were observed since yesterday. At least 20-30 workers are trapped inside." } },
    { reporter: "israt", title: "Wall Collapse at Lalbagh Construction Site", description: "A partially constructed building wall collapsed at a construction site near Lalbagh Fort. 3 construction workers buried under debris. Neighbors helping with rescue. Fire service on the way.", type: IncidentType.BUILDING_COLLAPSE, loc: "Lalbagh, Old Dhaka", lat: 23.7190, lng: 90.3890, cred: 85, severity: IncidentSeverity.HIGH, classType: IncidentType.BUILDING_COLLAPSE, classTitle: "Construction Wall Collapse Buries Workers Near Lalbagh", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(5) },
    { reporter: "nabila", title: "Savar Building Foundation Cracked", description: "A 6-story residential building in Savar has developed severe cracks in its foundation after heavy rain. 40+ families evacuated as a precaution. RAJUK inspection team requested.", type: IncidentType.BUILDING_COLLAPSE, loc: "Savar, Dhaka", lat: 23.8460, lng: 90.2566, cred: 78, severity: IncidentSeverity.MEDIUM, classType: IncidentType.BUILDING_COLLAPSE, classTitle: "Savar Residential Building Cracks Force Mass Evacuation", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(18) },

    // ── ROAD ACCIDENT ──
    { reporter: "karim", title: "Multi-Vehicle Collision on Airport Road", description: "A bus collided head-on with a CNG auto-rickshaw on Airport Road near Khilkhet flyover. At least 8 people injured, 2 critically. Ambulances dispatched. Traffic backed up for 3km.", type: IncidentType.ROAD_ACCIDENT, loc: "Airport Road, Khilkhet, Dhaka", lat: 23.8310, lng: 90.4225, cred: 90, severity: IncidentSeverity.HIGH, classType: IncidentType.ROAD_ACCIDENT, classTitle: "Multi-Vehicle Crash Injures Eight Near Khilkhet Flyover", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(2) },
    { reporter: "mithun", title: "Dhaka-Mymensingh Highway Truck Accident", description: "A loaded truck overturned on Dhaka-Mymensingh highway near Gazipur Chowrasta. Spilled cargo blocking both lanes. At least 3 vehicles damaged. Massive traffic jam building up.", type: IncidentType.ROAD_ACCIDENT, loc: "Gazipur Chowrasta", lat: 24.0000, lng: 90.4200, cred: 86, severity: IncidentSeverity.HIGH, classType: IncidentType.ROAD_ACCIDENT, classTitle: "Truck Overturns Blocking Dhaka-Mymensingh Highway at Gazipur", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(4) },
    { reporter: "hasina", title: "Narayanganj Bus-Tempo Collision", description: "BRTC bus hit a tempo near Shiddhhirganj rail crossing. Tempo passengers critically injured. 5 taken to hospital. Police managing traffic. Road partially blocked.", type: IncidentType.ROAD_ACCIDENT, loc: "Narayanganj Shiddhhirganj", lat: 23.6850, lng: 90.4960, cred: 83, severity: IncidentSeverity.MEDIUM, classType: IncidentType.ROAD_ACCIDENT, classTitle: "Bus-Tempo Collision Injures Five in Narayanganj", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(6) },
    { reporter: "monir", title: "Tongi Rail Crossing Accident", description: "A microbus was hit by a freight train at Tongi level crossing. Gate was reportedly not closed. Microbus completely destroyed. 4 passengers killed on spot, 3 injured. Police investigating.", type: IncidentType.ROAD_ACCIDENT, loc: "Tongi Level Crossing, Gazipur", lat: 23.9300, lng: 90.4010, cred: 94, severity: IncidentSeverity.CRITICAL, classType: IncidentType.ROAD_ACCIDENT, classTitle: "Fatal Train-Microbus Collision at Tongi Level Crossing", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(1) },
    { reporter: "meherun", title: "Comilla Highway Accident", description: "Two buses collided head-on on Dhaka-Chittagong highway near Comilla. Multiple casualties feared. Highway patrol and ambulances en route. Traffic being diverted through city roads.", type: IncidentType.ROAD_ACCIDENT, loc: "Comilla Kandirpar", lat: 23.4607, lng: 91.1809, cred: 87, severity: IncidentSeverity.CRITICAL, classType: IncidentType.ROAD_ACCIDENT, classTitle: "Head-On Bus Collision on Dhaka-Chittagong Highway", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(15) },

    // ── VIOLENCE ──
    { reporter: "nusrat", title: "Mugging at Banani Road-11", description: "Group of 4 muggers targeting pedestrians on Banani Road 11 after dark. Two victims robbed at knifepoint in the last hour. One victim injured. Police patrolling but muggers dispersed into alleys.", type: IncidentType.VIOLENCE, loc: "Banani Road-11, Dhaka", lat: 23.7940, lng: 90.4080, cred: 75, severity: IncidentSeverity.MEDIUM, classType: IncidentType.VIOLENCE, classTitle: "Armed Muggers Operating on Banani Road-11 After Dark", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(2) },
    { reporter: "jamal", title: "Clash at New Market Gate-2", description: "Multiple shoppers reporting pickpocketing and bag snatching near Gate 2 of New Market. At least 5 victims in the last hour. Two vendors got into a fight with suspects. Police arriving.", type: IncidentType.VIOLENCE, loc: "New Market, Dhaka", lat: 23.7340, lng: 90.3850, cred: 72, severity: IncidentSeverity.LOW, classType: IncidentType.VIOLENCE, classTitle: "Pickpocketing Spree and Vendor Clash at New Market", spam: false, status: IncidentStatus.PUBLISHED, ago: minutesAgo(45) },
    { reporter: "zahid", title: "Political Clash at Shahbag", description: "Clashes between two political groups near Shahbag intersection. Brick-throwing reported. Several cars vandalized. Police firing tear gas. Avoid the area. Shahbag to Science Lab route blocked.", type: IncidentType.VIOLENCE, loc: "Shahbag, Dhaka", lat: 23.7381, lng: 90.3953, cred: 80, severity: IncidentSeverity.HIGH, classType: IncidentType.VIOLENCE, classTitle: "Political Violence Erupts at Shahbag Intersection", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(5) },

    // ── MEDICAL EMERGENCY ──
    { reporter: "nasreen", title: "Elderly Person Collapsed in Dhanmondi", description: "An elderly man collapsed near Dhanmondi Lake. Bystanders performing CPR. Nearest hospital is Labaid on Road 4. Need ambulance immediately at Road 27 entrance. Man is unresponsive.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Dhanmondi Lake, Road 27, Dhaka", lat: 23.7465, lng: 90.3750, cred: 84, severity: IncidentSeverity.MEDIUM, classType: IncidentType.MEDICAL_EMERGENCY, classTitle: "Medical Emergency Near Dhanmondi Lake", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(1) },
    { reporter: "fatema", title: "Mass Food Poisoning at Farmgate Hotel", description: "At least 15 people hospitalized after eating at a roadside hotel near Farmgate. Symptoms include severe vomiting and diarrhea. Health department inspectors called. Hotel temporarily shut down.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Farmgate, Dhaka", lat: 23.7570, lng: 90.3876, cred: 81, severity: IncidentSeverity.HIGH, classType: IncidentType.MEDICAL_EMERGENCY, classTitle: "Mass Food Poisoning Hospitalizes 15 Near Farmgate", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(8) },
    { reporter: "salma", title: "Dengue Outbreak in Rampura", description: "Multiple dengue cases reported in Rampura West area in the last week. At least 30 confirmed cases, 3 hospitalized in critical condition. Breeding grounds found in construction sites.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Rampura, Dhaka", lat: 23.7635, lng: 90.4251, cred: 79, severity: IncidentSeverity.HIGH, classType: IncidentType.MEDICAL_EMERGENCY, classTitle: "Dengue Outbreak Surges in Rampura with 30 Confirmed Cases", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(20) },
    { reporter: "kalam", title: "Tourist Heatstroke on Cox's Bazar Beach", description: "3 tourists collapsed due to heatstroke on Kolatoli Beach. Temperature 42°C. Beach lifeguards providing first aid. Ambulance requested. One tourist is unconscious.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Cox's Bazar Kolatoli Beach", lat: 21.4272, lng: 92.0058, cred: 77, severity: IncidentSeverity.MEDIUM, classType: IncidentType.MEDICAL_EMERGENCY, classTitle: "Heatstroke Fells Tourists on Cox's Bazar Beach", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(4) },

    // ── EARTHQUAKE ──
    { reporter: "tanvir", title: "Earthquake Tremors Felt in Sylhet", description: "Strong tremors felt across Sylhet city. Buildings shaking for about 15 seconds. People running out of offices and homes. No damage confirmed yet but widespread panic. Aftershock possible.", type: IncidentType.EARTHQUAKE, loc: "Zindabazar, Sylhet", lat: 24.8949, lng: 91.8687, cred: 78, severity: IncidentSeverity.HIGH, classType: IncidentType.EARTHQUAKE, classTitle: "Earthquake Tremors Reported Across Sylhet City", spam: false, status: IncidentStatus.PUBLISHED, ago: minutesAgo(20) },
    { reporter: "moushumi", title: "Tremors in Rajshahi Too", description: "Tremors also felt in Rajshahi, likely the same earthquake. Lighter intensity here. Some cracks observed in older buildings near court area. University classes suspended as precaution.", type: IncidentType.EARTHQUAKE, loc: "Rajshahi Court Area", lat: 24.3745, lng: 88.6042, cred: 74, severity: IncidentSeverity.MEDIUM, classType: IncidentType.EARTHQUAKE, classTitle: "Earthquake Tremors Reach Rajshahi University Area", spam: false, status: IncidentStatus.PUBLISHED, ago: minutesAgo(15) },

    // ── OTHER ──
    { reporter: "imran", title: "Gas Leak in Badda Residential Area", description: "Strong gas smell reported in Badda residential blocks near Merul Badda. Titas Gas informed. Area partially evacuated. Residents warned not to use open flames. Gas line suspected to be damaged by construction work.", type: IncidentType.OTHER, loc: "Merul Badda, Dhaka", lat: 23.7803, lng: 90.4260, cred: 83, severity: IncidentSeverity.HIGH, classType: IncidentType.OTHER, classTitle: "Gas Leak Forces Evacuation in Badda Residential Area", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(3) },
    { reporter: "tahmina", title: "Major Water Pipe Burst in Mohammadpur", description: "WASA main water pipe burst near Mohammadpur bus stand. Road flooded. Clean water supply cut off for thousands of residents. WASA repair team dispatched. Traffic diverted.", type: IncidentType.OTHER, loc: "Mohammadpur, Dhaka", lat: 23.7662, lng: 90.3589, cred: 80, severity: IncidentSeverity.MEDIUM, classType: IncidentType.OTHER, classTitle: "WASA Pipe Burst Disrupts Water Supply in Mohammadpur", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(6) },
    { reporter: "faruk", title: "Power Grid Failure in Rangpur", description: "Complete power blackout across Rangpur city for 3+ hours. PDB says transformer failure at main grid station. Hospitals running on generators. Perishable goods at risk in markets.", type: IncidentType.OTHER, loc: "Rangpur Town Hall", lat: 25.7439, lng: 89.2752, cred: 82, severity: IncidentSeverity.MEDIUM, classType: IncidentType.OTHER, classTitle: "Transformer Failure Causes Citywide Blackout in Rangpur", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(10) },

    // ── UNDER_REVIEW / SPAM ──
    { reporter: "rojina", title: "Hatirjheel er Kache Sondehojoggo Golmal", description: "কিছু একটা হচ্ছে হাতিরঝিলের কাছে কিন্তু নিশ্চিত না কি হচ্ছে।", type: IncidentType.OTHER, loc: "Hatirjheel, Dhaka", lat: 23.7733, lng: 90.4150, cred: 35, severity: IncidentSeverity.LOW, classType: IncidentType.OTHER, classTitle: "Unverified Activity Near Hatirjheel", spam: false, status: IncidentStatus.UNDER_REVIEW, ago: minutesAgo(30) },
    { reporter: "babul", title: "Aliens Landed in Dhanmondi!", description: "I saw aliens landing near Dhanmondi lake. They were green and had laser guns. Please send the army.", type: IncidentType.OTHER, loc: "Dhanmondi-15, Dhaka", lat: 23.7416, lng: 90.3760, cred: 3, severity: IncidentSeverity.LOW, classType: IncidentType.OTHER, classTitle: "Unverified Claim — Likely Spam", spam: true, status: IncidentStatus.UNDER_REVIEW, ago: minutesAgo(10) },
    { reporter: "babul", title: "FREE GOLD AT MOTIJHEEL", description: "CLICK HERE TO GET FREE GOLD COINS. GOVERNMENT DISTRIBUTION AT MOTIJHEEL.", type: IncidentType.OTHER, loc: "Motijheel, Dhaka", lat: 23.7330, lng: 90.4172, cred: 2, severity: IncidentSeverity.LOW, classType: IncidentType.OTHER, classTitle: "Spam — Fraudulent Claim", spam: true, status: IncidentStatus.UNDER_REVIEW, ago: minutesAgo(5) },
    { reporter: "rojina", title: "Suspicious Package at Hatirjheel Park", description: "An unattended bag found near the Hatirjheel pedestrian bridge. Security guard notified. People avoiding the area. Might be nothing but reporting just in case.", type: IncidentType.OTHER, loc: "Hatirjheel, Dhaka", lat: 23.7730, lng: 90.4155, cred: 45, severity: IncidentSeverity.LOW, classType: IncidentType.OTHER, classTitle: "Unattended Bag Reported at Hatirjheel Park", spam: false, status: IncidentStatus.UNDER_REVIEW, ago: minutesAgo(15) },

    // ── Additional reports for cluster diversity ──
    { reporter: "rafiq", title: "Motijheel Office Workers Stranded", description: "Flooding in Motijheel area. Office workers unable to leave buildings. Rickshaws charging 10x fare. Water entering ground floor shops. Banks shutting early.", type: IncidentType.FLOOD, loc: "Motijheel, Dhaka", lat: 23.7335, lng: 90.4180, cred: 81, severity: IncidentSeverity.MEDIUM, classType: IncidentType.FLOOD, classTitle: "Flooding Strands Office Workers in Motijheel Commercial Hub", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(5) },
    { reporter: "mahbub", title: "Bashundhara Road Completely Underwater", description: "The main road through Bashundhara Residential Area is completely flooded. Cars stuck. Water entering Apollo Hospital emergency entrance. Patients being relocated.", type: IncidentType.FLOOD, loc: "Bashundhara R/A, Dhaka", lat: 23.8170, lng: 90.4310, cred: 89, severity: IncidentSeverity.HIGH, classType: IncidentType.FLOOD, classTitle: "Flooding Threatens Apollo Hospital in Bashundhara Area", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(4) },
    { reporter: "polash", title: "Chattogram Port Road Flooded", description: "Heavy rain has flooded the main port access road in Chattogram. Container trucks unable to move. Port operations partially halted. Economic losses mounting.", type: IncidentType.FLOOD, loc: "Chattogram Port Area", lat: 22.3300, lng: 91.8050, cred: 86, severity: IncidentSeverity.HIGH, classType: IncidentType.FLOOD, classTitle: "Flooding Halts Chattogram Port Operations", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(11) },
    { reporter: "kalam", title: "Cox's Bazar Beach Erosion Emergency", description: "Severe beach erosion at Kolatoli after cyclone. Two beachfront hotels partially damaged. Foundation exposed. Tourists evacuated. Marine Drive road cracking.", type: IncidentType.OTHER, loc: "Cox's Bazar Marine Drive", lat: 21.4300, lng: 92.0070, cred: 80, severity: IncidentSeverity.HIGH, classType: IncidentType.OTHER, classTitle: "Cyclone Erosion Damages Hotels Along Cox's Bazar Marine Drive", spam: false, status: IncidentStatus.PUBLISHED, ago: daysAgo(1) },
    { reporter: "monir", title: "Tongi Train Derailment Partial", description: "A goods train partially derailed near Tongi junction. No passenger trains affected yet. Track repair underway. Commuter services may be disrupted tomorrow morning.", type: IncidentType.ROAD_ACCIDENT, loc: "Tongi Junction, Gazipur", lat: 23.9310, lng: 90.4020, cred: 79, severity: IncidentSeverity.MEDIUM, classType: IncidentType.ROAD_ACCIDENT, classTitle: "Goods Train Partially Derails at Tongi Junction", spam: false, status: IncidentStatus.PUBLISHED, ago: hoursAgo(7) },
  ];

  const reports: Record<string, Awaited<ReturnType<typeof prisma.incidentReport.create>>> = {};
  let reportIdx = 0;
  for (const r of reportDefs) {
    const key = `report${reportIdx}`;
    reports[key] = await prisma.incidentReport.create({
      data: {
        reporterId: users[r.reporter].id,
        incidentTitle: r.title,
        description: r.description,
        incidentType: r.type,
        locationText: r.loc,
        latitude: r.lat,
        longitude: r.lng,
        mediaFilenames: [],
        sourceAudioFilename: r.voice?.audio ?? null,
        detectedLanguage: r.voice?.lang ?? null,
        languageProbability: r.voice?.langProb ?? null,
        translatedDescription: r.voice?.translated ?? null,
        credibilityScore: r.cred,
        severityLevel: r.severity,
        classifiedIncidentType: r.classType,
        classifiedIncidentTitle: r.classTitle,
        spamFlagged: r.spam,
        status: r.status,
        createdAt: r.ago
      }
    });
    reportIdx++;
  }

  const published = reportDefs.filter(r => r.status === IncidentStatus.PUBLISHED).length;
  const underReview = reportDefs.filter(r => r.status === IncidentStatus.UNDER_REVIEW).length;
  const spamCount = reportDefs.filter(r => r.spam).length;
  console.log(`  ${reportDefs.length} incident reports created (${published} published, ${underReview} under review, ${spamCount} spam)\n`);

  // ═══════════════════════════════════════════════════════════════
  // 3. CRISIS EVENTS — 12 clusters
  // ═══════════════════════════════════════════════════════════════
  console.log("Creating crisis event clusters...");

  const crisisDefs: Array<{
    title: string; type: IncidentType; severity: IncidentSeverity;
    loc: string; lat: number; lng: number; status: CrisisEventStatus;
    sitRep: string; reportKeys: string[]; ago: Date;
  }> = [
    { title: "Mirpur Monsoon Flooding Emergency", type: IncidentType.FLOOD, severity: IncidentSeverity.CRITICAL, loc: "Mirpur Section 10-12, Dhaka", lat: 23.8075, lng: 90.3688, status: CrisisEventStatus.ACTIVE, sitRep: "Severe monsoon flooding across Mirpur. Water levels 5+ feet in sections 10-12. Multiple families stranded on rooftops. Boat rescue operations underway. Sewage overflow contaminating floodwater. NDMO coordinating response. 3 shelters opened at local schools.", reportKeys: ["report0", "report1", "report2"], ago: hoursAgo(6) },
    { title: "Khulna Riverside Flood Crisis", type: IncidentType.FLOOD, severity: IncidentSeverity.CRITICAL, loc: "Sonadanga-Daulatpur, Khulna", lat: 22.8350, lng: 89.5500, status: CrisisEventStatus.ACTIVE, sitRep: "Rupsha River has breached danger level. 500+ families displaced in Sonadanga and Daulatpur. Army deployed for evacuation. 5 relief distribution centers active. Drinking water contamination confirmed in low-lying areas.", reportKeys: ["report3"], ago: hoursAgo(10) },
    { title: "Sylhet Flash Flood Emergency", type: IncidentType.FLOOD, severity: IncidentSeverity.CRITICAL, loc: "Sylhet-Sunamganj Region", lat: 24.9100, lng: 91.8500, status: CrisisEventStatus.ACTIVE, sitRep: "Flash flood from Meghalaya hills has inundated Sylhet-Sunamganj highway and surrounding villages. Army rescue operations active. Air force helicopters requested. 2000+ people stranded. Communication lines disrupted in several areas.", reportKeys: ["report5", "report6"], ago: hoursAgo(8) },
    { title: "Barisal River Embankment Breach", type: IncidentType.FLOOD, severity: IncidentSeverity.HIGH, loc: "Barisal Sadar", lat: 22.7010, lng: 90.3535, status: CrisisEventStatus.CONTAINED, sitRep: "Embankment breach has been partially repaired with sandbags. Flooding spreading slowed. 300 families relocated to cyclone shelters. Water purification tablets distributed. Situation stabilizing.", reportKeys: ["report4"], ago: hoursAgo(9) },
    { title: "Tejgaon Chemical Warehouse Fire", type: IncidentType.FIRE, severity: IncidentSeverity.HIGH, loc: "Tejgaon Industrial Area, Dhaka", lat: 23.7585, lng: 90.3930, status: CrisisEventStatus.CONTAINED, sitRep: "Warehouse fire now 80% contained. Toxic smoke advisory in effect for 2km radius. Schools closed early. Two firefighters treated for smoke inhalation. BCSIR team assessing chemical contamination risk.", reportKeys: ["report7", "report8"], ago: hoursAgo(12) },
    { title: "Agrabad Garment Factory Fire", type: IncidentType.FIRE, severity: IncidentSeverity.HIGH, loc: "Agrabad, Chattogram", lat: 22.3267, lng: 91.8127, status: CrisisEventStatus.RESOLVED, sitRep: "Fire fully extinguished after 6-hour operation. All workers accounted for — 5 minor injuries, no fatalities. BFSCD investigation identifies electrical short circuit as cause. Factory sealed pending safety inspection.", reportKeys: ["report9", "report10"], ago: hoursAgo(14) },
    { title: "Sadarghat Factory Building Collapse", type: IncidentType.BUILDING_COLLAPSE, severity: IncidentSeverity.CRITICAL, loc: "Sadarghat, Old Dhaka", lat: 23.7080, lng: 90.4050, status: CrisisEventStatus.ACTIVE, sitRep: "4-story garment factory partially collapsed. 25 workers rescued alive so far, 4 confirmed dead. NDRF teams using heavy equipment. RAJUK structural team confirms adjacent buildings are safe. Blood donation appeal issued by DMC.", reportKeys: ["report14"], ago: hoursAgo(3) },
    { title: "Khilkhet Flyover Multi-Vehicle Crash", type: IncidentType.ROAD_ACCIDENT, severity: IncidentSeverity.HIGH, loc: "Airport Road, Khilkhet, Dhaka", lat: 23.8310, lng: 90.4225, status: CrisisEventStatus.ACTIVE, sitRep: "Bus-CNG collision. 8 injured, 2 critical at DMCH. Traffic diverted via Bashundhara alternate route. Police investigating. Speed and brake failure suspected. Highway police monitoring area.", reportKeys: ["report18"], ago: hoursAgo(2) },
    { title: "Tongi Level Crossing Fatal Accident", type: IncidentType.ROAD_ACCIDENT, severity: IncidentSeverity.CRITICAL, loc: "Tongi, Gazipur", lat: 23.9300, lng: 90.4010, status: CrisisEventStatus.ACTIVE, sitRep: "Freight train hit a microbus at ungated level crossing. 4 dead, 3 critically injured. Railway authorities confirm gate operator was absent. Investigation underway. Demands rising for automated gates.", reportKeys: ["report21", "report47"], ago: hoursAgo(1) },
    { title: "Comilla Highway Bus Collision", type: IncidentType.ROAD_ACCIDENT, severity: IncidentSeverity.CRITICAL, loc: "Dhaka-Chittagong Highway, Comilla", lat: 23.4607, lng: 91.1809, status: CrisisEventStatus.RESOLVED, sitRep: "Both buses removed from highway. 7 dead, 22 injured. Highway reopened after 8 hours. Transport ministry orders safety audit of all long-distance bus operators.", reportKeys: ["report22"], ago: hoursAgo(15) },
    { title: "Shahbag Political Violence", type: IncidentType.VIOLENCE, severity: IncidentSeverity.HIGH, loc: "Shahbag, Dhaka", lat: 23.7381, lng: 90.3953, status: CrisisEventStatus.CONTAINED, sitRep: "Police have dispersed both groups using tear gas and water cannon. 15 arrests made. Shahbag intersection reopened with heavy police presence. DMP requests public to avoid area until further notice.", reportKeys: ["report25"], ago: hoursAgo(5) },
    { title: "Rampura Dengue Outbreak", type: IncidentType.MEDICAL_EMERGENCY, severity: IncidentSeverity.HIGH, loc: "Rampura, Dhaka", lat: 23.7635, lng: 90.4251, status: CrisisEventStatus.ACTIVE, sitRep: "30 confirmed dengue cases in Rampura West. DGHS mosquito eradication drive launched. Fogging scheduled for next 3 days. Blood bank reserves low — O-negative urgently needed. 3 patients in ICU at DMCH.", reportKeys: ["report29"], ago: hoursAgo(20) },
  ];

  const crisisEvents: Record<string, Awaited<ReturnType<typeof prisma.crisisEvent.create>>> = {};
  for (let i = 0; i < crisisDefs.length; i++) {
    const c = crisisDefs[i];
    crisisEvents[`ce${i}`] = await prisma.crisisEvent.create({
      data: {
        title: c.title,
        incidentType: c.type,
        severityLevel: c.severity,
        locationText: c.loc,
        latitude: c.lat,
        longitude: c.lng,
        status: c.status,
        sitRepText: c.sitRep,
        reportCount: c.reportKeys.length,
        reporterCount: new Set(c.reportKeys.map(k => reports[k]?.reporterId)).size,
        createdAt: c.ago
      }
    });

    for (const rk of c.reportKeys) {
      if (reports[rk]) {
        await prisma.crisisEventReport.create({
          data: { crisisEventId: crisisEvents[`ce${i}`].id, incidentReportId: reports[rk].id }
        });
      }
    }
  }

  const statusCounts = {
    ACTIVE: crisisDefs.filter(c => c.status === CrisisEventStatus.ACTIVE).length,
    CONTAINED: crisisDefs.filter(c => c.status === CrisisEventStatus.CONTAINED).length,
    RESOLVED: crisisDefs.filter(c => c.status === CrisisEventStatus.RESOLVED).length
  };
  console.log(`  ${crisisDefs.length} crisis events created (${statusCounts.ACTIVE} active, ${statusCounts.CONTAINED} contained, ${statusCounts.RESOLVED} resolved)\n`);

  // ═══════════════════════════════════════════════════════════════
  // 4. REVIEWS — ~80 reviews across 12 volunteers
  // ═══════════════════════════════════════════════════════════════
  console.log("Creating volunteer reviews...");

  const reviewerPool = [users.farhan, users.rahim, users.karim, users.nasreen, users.jamal,
    users.sumaiya, users.arif, users.fatema, users.rafiq, users.salma, users.mahbub,
    users.nusrat, users.imran, users.tahmina, users.shakil, users.ruma];

  const contexts = [InteractionContext.RESCUE_OPERATION, InteractionContext.MEDICAL_AID,
    InteractionContext.SUPPLY_DISTRIBUTION, InteractionContext.SHELTER_MANAGEMENT, InteractionContext.OTHER];

  const positiveTexts = [
    "চমৎকার কাজ করেছেন। পেশাদার এবং সময়নিষ্ঠ। আবার একসাথে কাজ করতে চাই।",
    "Outstanding work during the relief operation. Organized, calm, and effective. Highly recommended.",
    "Helped coordinate supply distribution efficiently. No confusion, everything was systematic and fair.",
    "Arrived on time, worked tirelessly for 12 hours. Showed genuine compassion for affected families.",
    "Excellent medical first aid skills. Treated multiple injured people before ambulances arrived.",
    "Great leadership during the shelter setup. Kept everyone motivated and well-organized.",
    "Very helpful with food distribution. Made sure elderly and children were served first.",
    "Professional approach to rescue operations. Followed safety protocols and kept the team focused.",
    "Provided excellent counseling to flood victims. Helped calm panicked families with patience.",
    "Managed logistics perfectly. All supplies reached the right locations on time.",
    "Impressive water rescue skills. Saved 3 families from flooded homes using inflatable boat.",
    "Coordinated blood donation camp efficiently. Collected 45 units in one day.",
    "Took charge of child care at the shelter. Children were safe, fed, and comfortable.",
    "Repaired damaged generator at relief camp within an hour. Camp had power throughout the night.",
    "Communicated clearly with all stakeholders — local authorities, victims, and fellow volunteers.",
  ];

  const negativeTexts = [
    "Showed up 3 hours late and left early. Did not complete assigned tasks. Very unreliable.",
    "Was rude to beneficiaries and argued with team leads. Created unnecessary tension.",
    "Did not follow safety protocols during rescue operation. Put others at risk.",
    "Seemed completely uninterested in helping. Spent most of the time on phone.",
    "Supply distribution was chaotic under their watch. Many families got nothing.",
    "Refused to help carry heavy supply boxes. Others had to cover their responsibilities.",
    "Was argumentative with coordination team. Disrupted the workflow multiple times.",
    "Arrived unprepared with no equipment despite being informed beforehand.",
  ];

  const fraudTexts = [
    "This is a total scam. They collected supplies and never delivered them to victims.",
    "This volunteer is a fraud. They were not present at the distribution site as claimed.",
    "They stole medical supplies from the relief center. Multiple witnesses confirm this.",
    "Completely dishonest person. Took supplies meant for flood victims for personal gain.",
    "This person is corrupt. They took bribe from vendors to give priority in distribution.",
    "Liar and fake volunteer. Was never at the rescue site despite claiming to be.",
  ];

  let reviewCount = 0;
  let flaggedReviewCount = 0;

  async function createReview(
    reviewerId: string, volunteerId: string, rating: number, text: string,
    context: InteractionContext, daysBack: number, wouldWorkAgain: boolean,
    flagged?: boolean, flagReasons?: string[]
  ) {
    await prisma.review.create({
      data: {
        reviewerId, volunteerId, rating, text,
        interactionContext: context,
        interactionDate: daysAgo(daysBack),
        wouldWorkAgain,
        isFlagged: flagged ?? false,
        flagReasons: flagReasons ?? [],
        createdAt: daysAgo(daysBack)
      }
    });
    reviewCount++;
    if (flagged) flaggedReviewCount++;
  }

  // Ayesha — exemplary volunteer: 8 positive reviews (avg ~4.6)
  for (let i = 0; i < 8; i++) {
    const reviewer = reviewerPool[i % reviewerPool.length];
    await createReview(reviewer.id, volunteers.ayesha.id, pick([4, 5, 5, 5]), positiveTexts[i % positiveTexts.length], contexts[i % contexts.length], 5 + i * 3, true);
  }

  // Kamrul — solid volunteer: 6 reviews (avg ~4.0)
  for (let i = 0; i < 6; i++) {
    const reviewer = reviewerPool[(i + 2) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.kamrul.id, pick([3, 4, 4, 5]), positiveTexts[(i + 3) % positiveTexts.length], contexts[i % contexts.length], 8 + i * 4, true);
  }

  // Rashida — good volunteer: 7 reviews (avg ~4.3)
  for (let i = 0; i < 7; i++) {
    const reviewer = reviewerPool[(i + 4) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.rashida.id, pick([4, 4, 5, 5]), positiveTexts[(i + 6) % positiveTexts.length], contexts[i % contexts.length], 4 + i * 3, true);
  }

  // Harun — decent volunteer: 5 reviews (avg ~3.6)
  for (let i = 0; i < 5; i++) {
    const reviewer = reviewerPool[(i + 6) % reviewerPool.length];
    const rating = i < 3 ? pick([3, 4]) : pick([3, 4, 4]);
    await createReview(reviewer.id, volunteers.harun.id, rating, positiveTexts[(i + 9) % positiveTexts.length], contexts[i % contexts.length], 6 + i * 5, true);
  }

  // Farzana — excellent nurse: 6 reviews (avg ~4.5)
  for (let i = 0; i < 6; i++) {
    const reviewer = reviewerPool[(i + 8) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.farzana.id, pick([4, 5, 5]), positiveTexts[(i + 2) % positiveTexts.length], pick([InteractionContext.MEDICAL_AID, InteractionContext.RESCUE_OPERATION]), 3 + i * 4, true);
  }

  // Masud — good rescuer: 5 reviews (avg ~4.2)
  for (let i = 0; i < 5; i++) {
    const reviewer = reviewerPool[(i + 10) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.masud.id, pick([4, 4, 5]), positiveTexts[(i + 8) % positiveTexts.length], pick([InteractionContext.RESCUE_OPERATION, InteractionContext.OTHER]), 7 + i * 5, true);
  }

  // Shirin — mixed: 4 reviews (avg ~3.25)
  for (let i = 0; i < 4; i++) {
    const reviewer = reviewerPool[(i + 12) % reviewerPool.length];
    const rating = i < 2 ? pick([4, 3]) : pick([2, 3]);
    const text = i < 2 ? positiveTexts[(i + 5) % positiveTexts.length] : negativeTexts[i % negativeTexts.length];
    await createReview(reviewer.id, volunteers.shirin.id, rating, text, contexts[i % contexts.length], 5 + i * 6, i < 2);
  }

  // Billal — FLAGGED (low avg rating): 6 reviews (avg ~1.5)
  for (let i = 0; i < 6; i++) {
    const reviewer = reviewerPool[(i + 1) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.billal.id, pick([1, 1, 2]), negativeTexts[i % negativeTexts.length], contexts[i % contexts.length], 3 + i * 4, false);
  }

  // Sohel — FLAGGED (fraud keywords 67%): 6 reviews, 4 with fraud text
  for (let i = 0; i < 4; i++) {
    const reviewer = reviewerPool[(i + 3) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.sohel.id, pick([1, 1, 2]),
      fraudTexts[i % fraudTexts.length], contexts[i % contexts.length], 4 + i * 5, false,
      true, ["Contains fraud keywords"]);
  }
  for (let i = 0; i < 2; i++) {
    const reviewer = reviewerPool[(i + 7) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.sohel.id, pick([3, 4]),
      positiveTexts[(i + 11) % positiveTexts.length], contexts[i % contexts.length], 2 + i * 3, true);
  }

  // Tania — few reviews: 3 (avg ~4.0)
  for (let i = 0; i < 3; i++) {
    const reviewer = reviewerPool[(i + 5) % reviewerPool.length];
    await createReview(reviewer.id, volunteers.tania.id, pick([4, 4, 5]), positiveTexts[(i + 7) % positiveTexts.length], contexts[i % contexts.length], 10 + i * 7, true);
  }

  // Alamgir — FLAGGED (negative trend, 4 "would not work again" in 30 days): 5 reviews
  for (let i = 0; i < 5; i++) {
    const reviewer = reviewerPool[(i + 9) % reviewerPool.length];
    const isNeg = i < 4;
    await createReview(reviewer.id, volunteers.alamgir.id, isNeg ? pick([1, 2]) : 3,
      isNeg ? negativeTexts[(i + 2) % negativeTexts.length] : positiveTexts[0],
      contexts[i % contexts.length], isNeg ? 5 + i * 5 : 40, !isNeg);
  }

  // Munira — fresh volunteer, 0 reviews (empty state)

  // New account flagged review
  await createReview(users.babul.id, volunteers.ayesha.id, 2,
    "Not impressed with the volunteer service at all. Very slow response.",
    InteractionContext.OTHER, 0, false, true, ["Account less than 1 day old", "Review text less than 20 characters"]);

  console.log(`  ${reviewCount} reviews created (${flaggedReviewCount} flagged)\n`);

  console.log("Running volunteer fraud detection...");
  for (const vol of Object.values(volunteers)) {
    await checkAndFlagVolunteer(vol.id);
  }
  console.log("  Done.\n");

  // ═══════════════════════════════════════════════════════════════
  // 5. RESOURCES — 30 items
  // ═══════════════════════════════════════════════════════════════
  console.log("Creating resources...");

  const resourceDefs: Array<{
    name: string; category: string; quantity: number; unit: string;
    condition: string; address: string; lat: number; lng: number;
    contact: string; notes: string; status: string; ownerKey: string;
  }> = [
    { name: "জরুরি প্রাথমিক চিকিৎসা কিট", category: "Medical Supplies", quantity: 25, unit: "kits", condition: "New", address: "বনানী রোড ১২, বাড়ি ৩৪, ঢাকা", lat: 23.7937, lng: 90.4066, contact: "Phone", notes: "Contains bandages, antiseptics, pain relievers, splints, CPR masks, and gloves", status: "Available", ownerKey: "farhan" },
    { name: "খাবার পানি (১ লিটার বোতল)", category: "Food & Water", quantity: 500, unit: "bottles", condition: "New", address: "গুলশান-১ কমিউনিটি সেন্টার, ঢাকা", lat: 23.7808, lng: 90.4167, contact: "SMS", notes: "Sealed 1-liter bottles from WASA. Ready for immediate distribution.", status: "Available", ownerKey: "jamal" },
    { name: "চাল (১০ কেজি বস্তা)", category: "Food & Water", quantity: 150, unit: "bags", condition: "New", address: "মিরপুর DOHS, ব্লক A, ঢাকা", lat: 23.8103, lng: 90.4125, contact: "Phone", notes: "Miniket rice, sealed packaging. Donated by local rice mill.", status: "Available", ownerKey: "rahim" },
    { name: "শীতের কম্বল", category: "Clothing", quantity: 100, unit: "pieces", condition: "Good", address: "ধানমন্ডি রোড ২৭, বাড়ি ৮৯, ঢাকা", lat: 23.7466, lng: 90.3736, contact: "In-App", notes: "Warm woolen blankets, cleaned and sanitized. Suitable for adults.", status: "Available", ownerKey: "nasreen" },
    { name: "পারিবারিক তাঁবু", category: "Shelter", quantity: 20, unit: "tents", condition: "Good", address: "বারিধারা DOHS, বাড়ি ৪৫, ঢাকা", lat: 23.7925, lng: 90.4101, contact: "Phone", notes: "4-person capacity, waterproof, includes stakes and ropes. UN donation batch.", status: "Available", ownerKey: "karim" },
    { name: "পোর্টেবল জেনারেটর (5kW)", category: "Tools & Equipment", quantity: 3, unit: "units", condition: "Good", address: "বসুন্ধরা আবাসিক এলাকা, রোড ১১২, ঢাকা", lat: 23.8167, lng: 90.4303, contact: "Phone", notes: "Diesel-powered, fuel-efficient. 8-hour runtime on full tank.", status: "Available", ownerKey: "mahbub" },
    { name: "অ্যাম্বুলেন্স ভ্যান", category: "Transportation", quantity: 1, unit: "vehicle", condition: "Good", address: "মোহাম্মদপুর কেন্দ্রীয় মসজিদ রোড, ঢাকা", lat: 23.7662, lng: 90.3589, contact: "Phone", notes: "Equipped with stretcher, oxygen cylinder, and basic medical equipment. Driver available 24/7.", status: "Available", ownerKey: "tahmina" },
    { name: "শিশু খাদ্য ও ডায়াপার", category: "Medical Supplies", quantity: 80, unit: "packs", condition: "New", address: "উত্তরা সেক্টর ৭, রোড ৩, ঢাকা", lat: 23.8759, lng: 90.3795, contact: "SMS", notes: "Various sizes, unopened packages. Priority for families with infants under 2 years.", status: "Available", ownerKey: "karim" },
    { name: "LED ফ্ল্যাশলাইট ও ব্যাটারি", category: "Tools & Equipment", quantity: 0, unit: "sets", condition: "New", address: "নিকেতন, বাড়ি ৬৭, ঢাকা", lat: 23.7833, lng: 90.4167, contact: "In-App", notes: "All units distributed during Mirpur flood emergency. Awaiting restock from donor.", status: "Depleted", ownerKey: "jamal" },
    { name: "রান্নার পাত্র সেট", category: "Other", quantity: 25, unit: "sets", condition: "Good", address: "লালমাটিয়া, রোড ৮, ঢাকা", lat: 23.7588, lng: 90.3705, contact: "Phone", notes: "Includes pots, pans, plates, cups, and utensils for 10 people per set.", status: "Available", ownerKey: "nasreen" },
    { name: "ওয়াটার পিউরিফিকেশন ট্যাবলেট", category: "Medical Supplies", quantity: 2000, unit: "tablets", condition: "New", address: "তেজগাঁও শিল্প এলাকা, ঢাকা", lat: 23.7583, lng: 90.3928, contact: "Phone", notes: "Aquatabs — each tablet purifies 1 liter of water. WHO approved.", status: "Available", ownerKey: "sumaiya" },
    { name: "স্যালাইন (ORS প্যাকেট)", category: "Medical Supplies", quantity: 500, unit: "packets", condition: "New", address: "ফার্মগেট, ঢাকা", lat: 23.7570, lng: 90.3876, contact: "Phone", notes: "WHO standard oral rehydration salts. Essential for diarrhea/dehydration treatment.", status: "Available", ownerKey: "fatema" },
    { name: "ইনফ্ল্যাটেবল রেসকিউ বোট", category: "Tools & Equipment", quantity: 4, unit: "boats", condition: "Good", address: "মিরপুর-১, ঢাকা ফায়ার স্টেশন", lat: 23.7956, lng: 90.3537, contact: "Phone", notes: "6-person capacity, with oars and life vests. Currently deployed in Mirpur flood zone.", status: "Low Stock", ownerKey: "rahim" },
    { name: "লাইফ জ্যাকেট", category: "Tools & Equipment", quantity: 35, unit: "pieces", condition: "Good", address: "সদরঘাট নৌ-টার্মিনাল, ঢাকা", lat: 23.7080, lng: 90.4050, contact: "In-App", notes: "Adult and child sizes available. Coast Guard donation.", status: "Available", ownerKey: "arif" },
    { name: "তারপলিন শিট", category: "Shelter", quantity: 60, unit: "sheets", condition: "New", address: "জাতিসংঘ ওয়্যারহাউস, সাভার", lat: 23.8460, lng: 90.2566, contact: "Phone", notes: "Heavy-duty 12x16 feet tarpaulins. Suitable for temporary roof cover.", status: "Available", ownerKey: "nabila" },
    { name: "পোর্টেবল সোলার প্যানেল", category: "Tools & Equipment", quantity: 8, unit: "units", condition: "New", address: "রাজশাহী সিটি কর্পোরেশন অফিস", lat: 24.3745, lng: 88.6042, contact: "Phone", notes: "50W foldable panels with USB ports. Can charge phones and small devices.", status: "Available", ownerKey: "moushumi" },
    { name: "ডিজেল জ্বালানি (ড্রাম)", category: "Other", quantity: 5, unit: "drums", condition: "New", address: "খুলনা সিটি কর্পোরেশন ওয়্যারহাউস", lat: 22.8456, lng: 89.5403, contact: "Phone", notes: "200L drums for generator operation. Reserved for emergency shelter use.", status: "Available", ownerKey: "saiful" },
    { name: "মশারি", category: "Medical Supplies", quantity: 200, unit: "pieces", condition: "New", address: "রামপুরা, ঢাকা সিটি কর্পোরেশন অফিস", lat: 23.7635, lng: 90.4251, contact: "In-App", notes: "Long-lasting insecticidal nets (LLIN). Distributed for dengue prevention campaign.", status: "Available", ownerKey: "salma" },
    { name: "স্ট্রেচার (ফোল্ডেবল)", category: "Medical Supplies", quantity: 6, unit: "units", condition: "Good", address: "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল", lat: 22.3480, lng: 91.7635, contact: "Phone", notes: "Lightweight aluminum foldable stretchers. Available for field operations.", status: "Available", ownerKey: "polash" },
    { name: "হ্যান্ড স্যানিটাইজার (বাল্ক)", category: "Medical Supplies", quantity: 3, unit: "cartons", condition: "New", address: "নারায়ণগঞ্জ সিভিল সার্জন অফিস", lat: 23.6850, lng: 90.4960, contact: "SMS", notes: "500ml bottles, 48 per carton. Alcohol-based, WHO formula.", status: "Low Stock", ownerKey: "hasina" },
    { name: "ড্রাই ফুড প্যাকেজ", category: "Food & Water", quantity: 300, unit: "packets", condition: "New", address: "বরিশাল রেলিফ গুদাম", lat: 22.7010, lng: 90.3535, contact: "Phone", notes: "Flattened rice (chira), molasses (gur), biscuits, dates. 3-day supply per packet.", status: "Available", ownerKey: "laizu" },
    { name: "মোটরচালিত পাম্প", category: "Tools & Equipment", quantity: 2, unit: "units", condition: "Good", address: "কেরানীগঞ্জ ফায়ার স্টেশন", lat: 23.6983, lng: 90.3460, contact: "Phone", notes: "2-inch pump for draining floodwater from basements and low areas. 500L/min capacity.", status: "Available", ownerKey: "shohag" },
    { name: "সাইক্লোন শেল্টার ম্যাট", category: "Shelter", quantity: 150, unit: "mats", condition: "Good", address: "কক্সবাজার সদর উপজেলা অফিস", lat: 21.4272, lng: 92.0058, contact: "In-App", notes: "Floor mats for cyclone shelter use. Cleaned and stored for next season.", status: "Available", ownerKey: "kalam" },
    { name: "রক্ত সংরক্ষণ ব্যাগ", category: "Medical Supplies", quantity: 0, unit: "units", condition: "New", address: "ঢাকা মেডিকেল কলেজ ব্লাড ব্যাংক", lat: 23.7260, lng: 90.3980, contact: "Phone", notes: "Stock depleted during Sadarghat collapse rescue. Emergency procurement in progress.", status: "Depleted", ownerKey: "arif" },
    { name: "রেইনকোট ও গামবুট", category: "Clothing", quantity: 40, unit: "sets", condition: "Good", address: "সিলেট সদর, ঢাকায়ন রোড", lat: 24.8949, lng: 91.8687, contact: "Phone", notes: "Adult size raincoats with gumboots. For rescue workers and volunteers.", status: "Available", ownerKey: "tanvir" },
    { name: "মেগাফোন ও সাইরেন", category: "Tools & Equipment", quantity: 10, unit: "units", condition: "Good", address: "ময়মনসিংহ জেলা প্রশাসক কার্যালয়", lat: 24.7471, lng: 90.4203, contact: "Phone", notes: "Battery-operated megaphones with built-in siren. For evacuation announcements.", status: "Available", ownerKey: "shamima" },
    { name: "পোর্টেবল ওয়াটার ফিল্টার", category: "Tools & Equipment", quantity: 15, unit: "units", condition: "New", address: "রংপুর সিটি কর্পোরেশন", lat: 25.7439, lng: 89.2752, contact: "In-App", notes: "LifeStraw Community filters. Each unit serves 100 people/day. Removes 99.9% bacteria.", status: "Available", ownerKey: "faruk" },
    { name: "ক্যান্ড ফুড (সার্ডিন ও বিনস)", category: "Food & Water", quantity: 8, unit: "cartons", condition: "New", address: "কুমিল্লা রেলিফ স্টোর", lat: 23.4607, lng: 91.1809, contact: "Phone", notes: "48 cans per carton. Long shelf life. Running low — last batch from WFP.", status: "Low Stock", ownerKey: "meherun" },
    { name: "টর্চলাইট ও হুইসেল কিট", category: "Tools & Equipment", quantity: 50, unit: "kits", condition: "New", address: "গাজীপুর সিভিল ডিফেন্স অফিস", lat: 24.0000, lng: 90.4200, contact: "SMS", notes: "Each kit: 1 LED torch, 2 AA batteries, 1 whistle. For search and rescue teams.", status: "Available", ownerKey: "mithun" },
    { name: "অক্সিজেন সিলিন্ডার (পোর্টেবল)", category: "Medical Supplies", quantity: 5, unit: "cylinders", condition: "Good", address: "জাতরাবাড়ি হেলথ কমপ্লেক্স", lat: 23.7100, lng: 90.4316, contact: "Phone", notes: "D-size portable cylinders with mask and regulator. For field medical use.", status: "Available", ownerKey: "ruma" },
  ];

  for (const rd of resourceDefs) {
    await prisma.resource.create({
      data: {
        name: rd.name,
        category: rd.category,
        quantity: rd.quantity,
        unit: rd.unit,
        condition: rd.condition,
        address: rd.address,
        latitude: rd.lat,
        longitude: rd.lng,
        contactPreference: rd.contact,
        notes: rd.notes,
        status: rd.status,
        userId: users[rd.ownerKey].id
      }
    });
  }

  const resAvailable = resourceDefs.filter(r => r.status === "Available").length;
  const resLow = resourceDefs.filter(r => r.status === "Low Stock").length;
  const resDepleted = resourceDefs.filter(r => r.status === "Depleted").length;
  console.log(`  ${resourceDefs.length} resources created (${resAvailable} available, ${resLow} low stock, ${resDepleted} depleted)\n`);

  // ═══════════════════════════════════════════════════════════════
  // 6. SECURE FOLDERS — 8 folders
  // ═══════════════════════════════════════════════════════════════
  console.log("Creating secure documentation...");

  let fileCount = 0;
  let noteCount = 0;
  let linkCount = 0;

  const f1 = await prisma.secureFolder.create({ data: { name: "মিরপুর বন্যা উদ্ধার সাক্ষ্য", description: "Photos and field notes from Mirpur Sections 10-12 flood rescue operations", crisisId: crisisEvents.ce0.id, ownerId: users.farhan.id } });
  await prisma.folderFile.createMany({ data: [
    { folderId: f1.id, uploaderId: users.farhan.id, fileName: "mirpur_flood_rescue_boat.jpg", fileUrl: "/uploads/docs/mirpur_flood_rescue_boat.jpg", fileType: "image/jpeg", sizeBytes: 2458624, gpsLat: 23.8070, gpsLng: 90.3680 },
    { folderId: f1.id, uploaderId: users.farhan.id, fileName: "mirpur_water_level_marker.jpg", fileUrl: "/uploads/docs/mirpur_water_level_marker.jpg", fileType: "image/jpeg", sizeBytes: 3145728, gpsLat: 23.8085, gpsLng: 90.3695 },
    { folderId: f1.id, uploaderId: users.rahim.id, fileName: "mirpur_rescue_video.mp4", fileUrl: "/uploads/docs/mirpur_rescue_video.mp4", fileType: "video/mp4", sizeBytes: 15728640, gpsLat: 23.8075, gpsLng: 90.3688 },
  ]});
  fileCount += 3;
  await prisma.folderNote.createMany({ data: [
    { folderId: f1.id, authorId: users.farhan.id, content: "সেকশন ১০ এর বিল্ডিং ৭ থেকে ৩টি পরিবার উদ্ধার করা হয়েছে। পানির স্তর ৬ ফুট। ইনফ্ল্যাটেবল বোট ব্যবহার করা হয়েছে। কোনো হতাহত নেই। সবাইকে মিরপুর DOHS আশ্রয়কেন্দ্রে স্থানান্তর করা হয়েছে।", gpsLat: 23.8070, gpsLng: 90.3680 },
    { folderId: f1.id, authorId: users.rahim.id, content: "রিলিফ সামগ্রী বিতরণ সম্পন্ন: ৫০ কেজি চাল, ৩০ লিটার পানি, ১৫টি কম্বল, ১০টি প্রাথমিক চিকিৎসা কিট। শিশু ও বৃদ্ধদের অগ্রাধিকার দেওয়া হয়েছে।", gpsLat: 23.8085, gpsLng: 90.3695 },
    { folderId: f1.id, authorId: users.shakil.id, content: "Mirpur-12 bosti assessment: 150 tin-shed homes partially submerged. Clean water supply completely cut. Tube wells contaminated. Urgent need for purification tablets and ORS.", gpsLat: 23.8219, gpsLng: 90.3654 },
  ]});
  noteCount += 3;
  await prisma.shareLink.create({ data: { folderId: f1.id, token: "share_mirpur_flood_2026_abc", expiresAt: new Date(Date.now() + 7 * 86400000) } });
  linkCount++;

  const f2 = await prisma.secureFolder.create({ data: { name: "সদরঘাট ভবন ধস তদন্ত", description: "Structural assessment and rescue documentation for Sadarghat factory collapse", crisisId: crisisEvents.ce6.id, ownerId: users.arif.id } });
  await prisma.folderFile.createMany({ data: [
    { folderId: f2.id, uploaderId: users.arif.id, fileName: "sadarghat_collapse_overview.jpg", fileUrl: "/uploads/docs/sadarghat_collapse_overview.jpg", fileType: "image/jpeg", sizeBytes: 4194304, gpsLat: 23.7080, gpsLng: 90.4050 },
    { folderId: f2.id, uploaderId: users.arif.id, fileName: "sadarghat_rescue_team.jpg", fileUrl: "/uploads/docs/sadarghat_rescue_team.jpg", fileType: "image/jpeg", sizeBytes: 2097152, gpsLat: 23.7082, gpsLng: 90.4048 },
    { folderId: f2.id, uploaderId: users.israt.id, fileName: "sadarghat_structural_report.pdf", fileUrl: "/uploads/docs/sadarghat_structural_report.pdf", fileType: "application/pdf", sizeBytes: 1048576, gpsLat: 23.7080, gpsLng: 90.4050 },
  ]});
  fileCount += 3;
  await prisma.folderNote.createMany({ data: [
    { folderId: f2.id, authorId: users.arif.id, content: "প্রাথমিক মূল্যায়ন: ৪ তলা ভবন, পূর্ব পাশ সম্পূর্ণ ধসে পড়েছে। এখন পর্যন্ত ২৫ জন শ্রমিক জীবিত উদ্ধার, ৪ জন মৃত নিশ্চিত। RAJUK দল জানিয়েছে পার্শ্ববর্তী ভবন নিরাপদ।", gpsLat: 23.7080, gpsLng: 90.4050 },
    { folderId: f2.id, authorId: users.israt.id, content: "RAJUK structural inspection confirms: building had unauthorized 4th floor addition. No proper foundation reinforcement. Owner arrested. Adjacent buildings cleared for occupancy.", gpsLat: 23.7190, gpsLng: 90.3890 },
  ]});
  noteCount += 2;
  await prisma.shareLink.create({ data: { folderId: f2.id, token: "share_sadarghat_collapse_xyz", expiresAt: new Date(Date.now() + 14 * 86400000) } });
  linkCount++;

  const f3 = await prisma.secureFolder.create({ data: { name: "সিলেট বন্যা জরুরি নথি", description: "Flash flood rescue and relief documentation for Sylhet-Sunamganj region", crisisId: crisisEvents.ce2.id, ownerId: users.tanvir.id } });
  await prisma.folderFile.createMany({ data: [
    { folderId: f3.id, uploaderId: users.tanvir.id, fileName: "sylhet_highway_flood.jpg", fileUrl: "/uploads/docs/sylhet_highway_flood.jpg", fileType: "image/jpeg", sizeBytes: 3500000, gpsLat: 24.9100, gpsLng: 91.8500 },
    { folderId: f3.id, uploaderId: users.tanvir.id, fileName: "sylhet_air_rescue.jpg", fileUrl: "/uploads/docs/sylhet_air_rescue.jpg", fileType: "image/jpeg", sizeBytes: 2800000, gpsLat: 24.9050, gpsLng: 91.8550 },
  ]});
  fileCount += 2;
  await prisma.folderNote.create({ data: { folderId: f3.id, authorId: users.tanvir.id, content: "Army rescue team deployed via helicopter. 500 people airlifted from Sunamganj char areas. Communication lines restored in Zindabazar. Relief camp set up at MC College with capacity for 2000.", gpsLat: 24.8949, gpsLng: 91.8687 } });
  noteCount++;

  const f4 = await prisma.secureFolder.create({ data: { name: "স্বেচ্ছাসেবক প্রশিক্ষণ — এপ্রিল ২০২৬", description: "CPR, water rescue, and first aid training session documentation", ownerId: volunteers.ayesha.id } });
  await prisma.folderFile.createMany({ data: [
    { folderId: f4.id, uploaderId: volunteers.ayesha.id, fileName: "training_cpr_session.jpg", fileUrl: "/uploads/docs/training_cpr_session.jpg", fileType: "image/jpeg", sizeBytes: 1843200, gpsLat: 23.7937, gpsLng: 90.4066 },
    { folderId: f4.id, uploaderId: volunteers.kamrul.id, fileName: "training_water_rescue.jpg", fileUrl: "/uploads/docs/training_water_rescue.jpg", fileType: "image/jpeg", sizeBytes: 2200000, gpsLat: 23.7940, gpsLng: 90.4070 },
  ]});
  fileCount += 2;
  await prisma.folderNote.create({ data: { folderId: f4.id, authorId: volunteers.ayesha.id, content: "প্রশিক্ষণ সম্পন্ন: ২০ জন স্বেচ্ছাসেবক CPR, পানি উদ্ধার কৌশল, এবং প্রাথমিক চিকিৎসায় সার্টিফাইড। সময়কাল ৮ ঘন্টা। পরবর্তী সেশন মে ১৫ তারিখে নির্ধারিত।", gpsLat: 23.7937, gpsLng: 90.4066 } });
  noteCount++;
  await prisma.shareLink.create({ data: { folderId: f4.id, token: "share_training_apr2026_docs", expiresAt: new Date(Date.now() + 30 * 86400000) } });
  linkCount++;

  const f5 = await prisma.secureFolder.create({ data: { name: "চট্টগ্রাম গার্মেন্টস অগ্নিকাণ্ড রিপোর্ট", description: "Investigation and safety audit documents for Agrabad factory fire", crisisId: crisisEvents.ce5.id, ownerId: users.polash.id } });
  await prisma.folderFile.create({ data: { folderId: f5.id, uploaderId: users.polash.id, fileName: "agrabad_fire_investigation.pdf", fileUrl: "/uploads/docs/agrabad_fire_investigation.pdf", fileType: "application/pdf", sizeBytes: 2500000, gpsLat: 22.3267, gpsLng: 91.8127 } });
  fileCount++;
  await prisma.folderNote.create({ data: { folderId: f5.id, authorId: users.polash.id, content: "BFSCD investigation report: Fire caused by electrical short circuit on 3rd floor wiring panel. Factory had expired fire safety certificate. All 1200 workers safely evacuated. 5 minor injuries. Factory sealed by DIFE.", gpsLat: 22.3267, gpsLng: 91.8127 } });
  noteCount++;

  const f6 = await prisma.secureFolder.create({ data: { name: "রামপুরা ডেঙ্গু প্রতিরোধ অভিযান", description: "Dengue outbreak response documentation for Rampura area", crisisId: crisisEvents.ce11.id, ownerId: users.salma.id } });
  await prisma.folderFile.create({ data: { folderId: f6.id, uploaderId: users.salma.id, fileName: "rampura_fogging_schedule.pdf", fileUrl: "/uploads/docs/rampura_fogging_schedule.pdf", fileType: "application/pdf", sizeBytes: 800000, gpsLat: 23.7635, gpsLng: 90.4251 } });
  fileCount++;
  await prisma.folderNote.createMany({ data: [
    { folderId: f6.id, authorId: users.salma.id, content: "DGHS fogging campaign: Day 1 completed covering 12 wards. 45 breeding sites identified and destroyed. 200 mosquito nets distributed. Blood testing camp set up at Rampura Bazar.", gpsLat: 23.7635, gpsLng: 90.4251 },
    { folderId: f6.id, authorId: users.imran.id, content: "Construction site at Merul Badda identified as major Aedes breeding ground. DSCC fined the contractor. Site drained and treated. Follow-up inspection in 48 hours.", gpsLat: 23.7803, gpsLng: 90.4260 },
  ]});
  noteCount += 2;
  await prisma.shareLink.create({ data: { folderId: f6.id, token: "share_rampura_dengue_2026", expiresAt: new Date(Date.now() + 21 * 86400000) } });
  linkCount++;

  const f7 = await prisma.secureFolder.create({ data: { name: "খুলনা বন্যা রিলিফ কার্যক্রম", description: "Relief distribution records for Khulna riverside flooding", crisisId: crisisEvents.ce1.id, ownerId: users.saiful.id } });
  await prisma.folderNote.create({ data: { folderId: f7.id, authorId: users.saiful.id, content: "রিলিফ বিতরণ: সোনাদাঙ্গা ৩০০ পরিবার, দৌলতপুর ২০০ পরিবার। প্রতি পরিবারে ১০ কেজি চাল, ৫ লিটার পানি, ১ প্যাকেট ওরস্যালাইন, ১টি তারপলিন। মোট ব্যয় ১২ লক্ষ টাকা।", gpsLat: 22.8456, gpsLng: 89.5403 } });
  noteCount++;

  await prisma.secureFolder.create({ data: { name: "আর্কাইভ — পুরান ঢাকা মূল্যায়ন ২০২৫", description: "Previous year structural assessment records — archived", ownerId: users.arif.id, isDeleted: true, deletedAt: daysAgo(14) } });

  const totalFolders = 8;
  console.log(`  ${totalFolders} secure folders (1 archived), ${fileCount} files, ${noteCount} notes, ${linkCount} share links\n`);

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log("══════════════════════════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("══════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Admins (password: Admin@12345):");
  console.log(`    ${process.env.ADMIN_EMAIL ?? "admin@core.local"}`);
  console.log("    mizan@core.local");
  console.log("");
  console.log(`  Users: ${userData.length} (password: User@12345)`);
  console.log("    farhan@core.local  — demo account");
  console.log("    babul@core.local   — NEW account (<1 day, fraud flag trigger)");
  console.log("");
  console.log(`  Volunteers: ${volunteerData.length} (password: Volunteer@12345)`);
  console.log("    ayesha.vol@core.local  — Exemplary (4.6★, 8 reviews)");
  console.log("    kamrul.vol@core.local  — Solid (4.0★, 6 reviews)");
  console.log("    rashida.vol@core.local — Good (4.3★, 7 reviews)");
  console.log("    farzana.vol@core.local — Excellent nurse (4.5★, 6 reviews)");
  console.log("    masud.vol@core.local   — Good rescuer (4.2★, 5 reviews)");
  console.log("    billal.vol@core.local  — FLAGGED (1.5★ avg, low-rating)");
  console.log("    sohel.vol@core.local   — FLAGGED (67% fraud keywords)");
  console.log("    alamgir.vol@core.local — FLAGGED (4 negative-trend in 30d)");
  console.log("    munira.vol@core.local  — Fresh, zero reviews");
  console.log("");
  console.log(`  Reports: ${reportDefs.length} (${published} published, ${underReview} under review, ${spamCount} spam)`);
  console.log(`  Crisis Events: ${crisisDefs.length} (${statusCounts.ACTIVE} active, ${statusCounts.CONTAINED} contained, ${statusCounts.RESOLVED} resolved)`);
  console.log(`  Reviews: ${reviewCount} (${flaggedReviewCount} flagged, 3 flagged volunteers)`);
  console.log(`  Resources: ${resourceDefs.length} (${resAvailable} available, ${resLow} low stock, ${resDepleted} depleted)`);
  console.log(`  Secure Folders: ${totalFolders} (1 archived), ${fileCount} files, ${noteCount} notes, ${linkCount} share links`);
  console.log("══════════════════════════════════════════════════════════\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
