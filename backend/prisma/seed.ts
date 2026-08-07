import "dotenv/config";

import {
  PrismaClient,
  Role,
  InteractionContext,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  CrisisEventStatus,
  CrisisUpdateType,
  CrisisUpdateVerificationStatus,
  CrisisAccessStatus,
  CrisisResponderStatus,
  TaskCategory,
  TaskStatus,
  BadgeType,
  ClaimType,
  EvidenceState,
  EvidenceEdgeType,
  AssignmentStatus,
  AllocationStatus,
  BriefStatus,
  DispatchAlertStatus,
  NotificationType,
  NotificationDeliveryState,
  MediaVisibility,
  OutboxJobType,
  OutboxJobState,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Time helpers ──────────────────────────────────────────────
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
const minsAgo = (m: number) => new Date(Date.now() - m * 60000);
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000);
const hashPwd = (pw: string) => bcrypt.hash(pw, 12);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// ── Phone sequence ────────────────────────────────────────────
let phoneSeq = 1;
const nextPhone = () => `+88017${String(phoneSeq++).padStart(8, "0")}`;

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CORE Platform — Demo Seed");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Wipe ────────────────────────────────────────────────────
  console.log("Wiping existing data...");
  const models = [
    "shareLink", "folderNote", "folderFile", "secureFolder",
    "fulfillment", "stockLedgerEntry",
    "allocation", "assignment", "need", "situationBrief",
    "actionDraft", "decision", "evidenceEdge", "claim",
    "aIAnalysis", "sourceAsset", "signal", "mediaAsset",
    "oCRItem", "oCRScan", "nGOReport",
    "dispatchAlertLog", "badge", "volunteerTask",
    "pushSubscription", "notification", "notificationSubscription",
    "crisisEventUpdate", "crisisResponder", "evidenceFlag",
    "evidencePostVersion", "evidencePost",
    "resourceHistory", "reservation", "resource",
    "crisisEventReport", "crisisEvent",
    "incidentReport", "review",
    "outboxJob", "auditEvent", "idempotencyKey",
    "responderProfile", "organization", "user",
  ];
  for (const m of models) {
    await (prisma as any)[m].deleteMany({});
  }
  console.log("  Done.\n");

  // ════════════════════════════════════════════════════════════
  // 1. USERS
  // ════════════════════════════════════════════════════════════
  console.log("Creating users...");
  const adminPw = await hashPwd("Admin@12345");
  const userPw = await hashPwd("User@12345");
  const volPw = await hashPwd("Volunteer@12345");

  // ── Admins ──
  const admin1 = await prisma.user.create({
    data: {
      fullName: "Admin User",
      email: "admin@core.local",
      phone: "+8801700000000",
      passwordHash: adminPw,
      location: "Dhaka, Bangladesh",
      latitude: 23.8103,
      longitude: 90.4125,
      role: Role.ADMIN,
      skills: [],
      createdAt: daysAgo(365),
    },
  });

  const admin2 = await prisma.user.create({
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
      createdAt: daysAgo(200),
    },
  });

  // ── Regular users ──
  const userDefs = [
    { fullName: "Farhan Zarif", email: "farhan@core.local", loc: "Mohakhali, Dhaka", lat: 23.7785, lng: 90.4065, days: 180 },
    { fullName: "Rahim Uddin", email: "rahim@core.local", loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, days: 150 },
    { fullName: "Karim Hossain", email: "karim@core.local", loc: "Uttara, Dhaka", lat: 23.8759, lng: 90.3795, days: 140 },
    { fullName: "Nasreen Akter", email: "nasreen@core.local", loc: "Dhanmondi, Dhaka", lat: 23.7466, lng: 90.3736, days: 130 },
    { fullName: "Jamal Ahmed", email: "jamal@core.local", loc: "Gulshan-1, Dhaka", lat: 23.7808, lng: 90.4167, days: 120 },
    { fullName: "Sumaiya Rahman", email: "sumaiya@core.local", loc: "Tejgaon, Dhaka", lat: 23.7583, lng: 90.3928, days: 110 },
    { fullName: "Arif Khan", email: "arif@core.local", loc: "Sadarghat, Dhaka", lat: 23.7080, lng: 90.4050, days: 100 },
    { fullName: "Fatema Begum", email: "fatema@core.local", loc: "Farmgate, Dhaka", lat: 23.7570, lng: 90.3876, days: 95 },
    { fullName: "Rafiq Islam", email: "rafiq@core.local", loc: "Motijheel, Dhaka", lat: 23.7330, lng: 90.4172, days: 90 },
    { fullName: "Salma Khatun", email: "salma@core.local", loc: "Rampura, Dhaka", lat: 23.7635, lng: 90.4251, days: 85 },
    { fullName: "Polash Chowdhury", email: "polash@core.local", loc: "Agrabad, Chattogram", lat: 22.3267, lng: 91.8127, days: 40 },
    { fullName: "Tanvir Hasan", email: "tanvir@core.local", loc: "Sylhet", lat: 24.8949, lng: 91.8687, days: 35 },
    { fullName: "Shakil Ahmed", email: "shakil@core.local", loc: "Mirpur-12, Dhaka", lat: 23.8219, lng: 90.3654, days: 70 },
    { fullName: "Saiful Islam", email: "saiful@core.local", loc: "Sonadanga, Khulna", lat: 22.8350, lng: 89.5500, days: 60 },
    { fullName: "Ruma Akter", email: "ruma@core.local", loc: "Jatrabari, Dhaka", lat: 23.7100, lng: 90.4316, days: 50 },
    { fullName: "Monir Hossain", email: "monir@core.local", loc: "Tongi, Gazipur", lat: 23.9300, lng: 90.4010, days: 45 },
    { fullName: "Nusrat Jahan", email: "nusrat@core.local", loc: "Banani, Dhaka", lat: 23.7940, lng: 90.4080, days: 30 },
  ];

  const users: Record<string, any> = {};
  for (const u of userDefs) {
    const key = u.email.split("@")[0];
    users[key] = await prisma.user.create({
      data: {
        fullName: u.fullName,
        email: u.email,
        phone: nextPhone(),
        passwordHash: userPw,
        location: u.loc,
        latitude: u.lat,
        longitude: u.lng,
        role: Role.USER,
        skills: [],
        createdAt: daysAgo(u.days),
      },
    });
  }

  // ── Volunteers ──
  const volDefs = [
    { fullName: "Ayesha Siddiqua", email: "ayesha.vol@core.local", loc: "Banani, Dhaka", lat: 23.7937, lng: 90.4066, skills: ["First Aid", "Search & Rescue", "CPR"], avail: "Weekends", certs: "Red Cross First Aid", days: 300, dispatch: true },
    { fullName: "Kamrul Islam", email: "kamrul.vol@core.local", loc: "Mirpur, Dhaka", lat: 23.7956, lng: 90.3537, skills: ["Medical Aid", "Counseling"], avail: "Part-time", certs: "Basic Life Support", days: 250, dispatch: true },
    { fullName: "Rashida Begum", email: "rashida.vol@core.local", loc: "Dhanmondi, Dhaka", lat: 23.7466, lng: 90.3736, skills: ["Shelter Management", "Food Distribution"], avail: "Full-time", certs: "Disaster Management L2", days: 200, dispatch: true },
    { fullName: "Harun-or-Rashid", email: "harun.vol@core.local", loc: "Uttara, Dhaka", lat: 23.8614, lng: 90.3896, skills: ["Logistics", "Driving"], avail: "Full-time", certs: "Warehouse Management", days: 180, dispatch: false },
    { fullName: "Farzana Alam", email: "farzana.vol@core.local", loc: "Gulshan, Dhaka", lat: 23.7948, lng: 90.4143, skills: ["Medical Aid", "Nursing"], avail: "On-call", certs: "Registered Nurse", days: 160, dispatch: true },
    { fullName: "Masud Rana", email: "masud.vol@core.local", loc: "Chattogram", lat: 22.3480, lng: 91.7635, skills: ["Water Rescue", "Boat Handling"], avail: "Full-time", certs: "Swift Water Rescue", days: 140, dispatch: true },
    { fullName: "Billal Hossain", email: "billal.vol@core.local", loc: "Khulna", lat: 22.8456, lng: 89.5403, skills: ["Supply Distribution"], avail: "Part-time", certs: "None", days: 100, dispatch: false, flagged: true, flagReasons: ["Average rating below 2.0"] },
    { fullName: "Munira Khatun", email: "munira.vol@core.local", loc: "Cox's Bazar", lat: 21.4272, lng: 92.0058, skills: ["Shelter Management", "Child Care"], avail: "Full-time", certs: "Shelter Management", days: 20, dispatch: false },
  ];

  const volunteers: Record<string, any> = {};
  for (const v of volDefs) {
    const key = v.email.split("@")[0].replace(".vol", "");
    volunteers[key] = await prisma.user.create({
      data: {
        fullName: v.fullName,
        email: v.email,
        phone: nextPhone(),
        passwordHash: volPw,
        location: v.loc,
        latitude: v.lat,
        longitude: v.lng,
        role: Role.VOLUNTEER,
        skills: v.skills,
        availability: v.avail,
        certifications: v.certs,
        dispatchOptIn: v.dispatch,
        isFlagged: v.flagged ?? false,
        volunteerFlagReasons: v.flagReasons ?? [],
        totalPoints: v.flagged ? 0 : Math.floor(Math.random() * 300) + 50,
        totalVerifiedHours: v.flagged ? 0 : Math.floor(Math.random() * 40) + 5,
        createdAt: daysAgo(v.days),
      },
    });
  }

  console.log(`  ${userDefs.length} users, ${volDefs.length} volunteers, 2 admins\n`);

  // ════════════════════════════════════════════════════════════
  // 2. INCIDENT REPORTS
  // ════════════════════════════════════════════════════════════
  console.log("Creating incident reports...");

  const reportDefs: Array<{
    reporter: string; title: string; desc: string;
    type: IncidentType; loc: string; lat: number; lng: number;
    status: IncidentStatus; ago: Date;
    voice?: { audio: string; lang: string; prob: number; translated: string };
  }> = [
    // FLOOD
    { reporter: "rahim", title: "Severe Flooding in Mirpur-10", desc: "Heavy monsoon rain caused severe flooding in Mirpur sections 10-12. Water level above 5 feet in streets. Families stranded on rooftops. Emergency boat rescue needed urgently. Many children and elderly among stranded.", type: IncidentType.FLOOD, loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, status: IncidentStatus.PUBLISHED, ago: hoursAgo(6), voice: { audio: "/uploads/voice/mirpur_flood.webm", lang: "bn", prob: 0.97, translated: "Severe flooding in Mirpur. Water above 5 feet. Families stranded on rooftops." } },
    { reporter: "shakil", title: "Mirpur-12 Slum Flooded", desc: "Water entering homes in Mirpur-12 slum area near the embankment. People climbing to rooftops with children. No food or clean water available. Sewage mixing with flood water creating health hazard.", type: IncidentType.FLOOD, loc: "Mirpur-12, Dhaka", lat: 23.8219, lng: 90.3654, status: IncidentStatus.PUBLISHED, ago: hoursAgo(4) },
    { reporter: "saiful", title: "Khulna Riverside Flooding", desc: "Rupsha River crossed danger mark at Khulna. Low-lying areas in Sonadanga and Shibbari inundated. 500 families displaced. Embankment breached at two points. Local administration seeking army assistance for evacuation.", type: IncidentType.FLOOD, loc: "Sonadanga, Khulna", lat: 22.8350, lng: 89.5500, status: IncidentStatus.PUBLISHED, ago: hoursAgo(10) },
    { reporter: "tanvir", title: "Sylhet-Sunamganj Highway Submerged", desc: "Sylhet-Sunamganj highway under 4 feet of water. Flash flood from Meghalaya hills in India. Army rescue operations active. 2000+ people stranded in multiple villages. Surma River flowing above danger level.", type: IncidentType.FLOOD, loc: "Sylhet-Sunamganj Highway", lat: 24.9100, lng: 91.8500, status: IncidentStatus.PUBLISHED, ago: hoursAgo(8) },
    { reporter: "rafiq", title: "Motijheel Commercial Area Flooded", desc: "Flooding in Motijheel commercial district. Office workers unable to leave buildings. Water entering ground floor shops and banks. Drainage system overwhelmed by monsoon rainfall.", type: IncidentType.FLOOD, loc: "Motijheel, Dhaka", lat: 23.7335, lng: 90.4180, status: IncidentStatus.PUBLISHED, ago: hoursAgo(5) },
    // FIRE
    { reporter: "sumaiya", title: "Tejgaon Chemical Warehouse Fire", desc: "Large fire at chemical warehouse in Tejgaon I/A. Thick black smoke visible for 3 kilometers. Multiple fire units from Dhaka Fire Service responding. Nearby factories evacuating. Risk of chemical explosion. Workers reported missing.", type: IncidentType.FIRE, loc: "Tejgaon I/A, Dhaka", lat: 23.7583, lng: 90.3928, status: IncidentStatus.PUBLISHED, ago: hoursAgo(12) },
    { reporter: "polash", title: "Agrabad Garment Factory Fire", desc: "Fire on 3rd floor of garment factory in Agrabad EPZ, Chattogram. 1200 workers evacuated. 2 fire engines on scene from Agrabad Fire Station. 5 workers with minor burns treated at Chattogram Medical College Hospital.", type: IncidentType.FIRE, loc: "Agrabad EPZ, Chattogram", lat: 22.3267, lng: 91.8127, status: IncidentStatus.PUBLISHED, ago: hoursAgo(14) },
    { reporter: "ruma", title: "Slum Fire in Jatrabari", desc: "Fire in densely packed slum near Jatrabari bus stand. 30 tin-shed homes engulfed. Families fleeing with belongings. Dhaka Fire Service dispatched 4 units. Cause suspected to be LPG cylinder explosion.", type: IncidentType.FIRE, loc: "Jatrabari, Dhaka", lat: 23.7100, lng: 90.4316, status: IncidentStatus.PUBLISHED, ago: hoursAgo(3) },
    // BUILDING COLLAPSE
    { reporter: "arif", title: "Sadarghat Building Collapse", desc: "4-story garment factory building collapsed in Sadarghat, Old Dhaka. 20-30 workers trapped inside. Cracks were observed and reported to RAJUK yesterday but no action taken. NDRF and Fire Service rescue operations underway. Blood donation appeal issued.", type: IncidentType.BUILDING_COLLAPSE, loc: "Sadarghat, Old Dhaka", lat: 23.7080, lng: 90.4050, status: IncidentStatus.PUBLISHED, ago: hoursAgo(3), voice: { audio: "/uploads/voice/sadarghat.webm", lang: "bn", prob: 0.96, translated: "4-story building collapsed in Sadarghat. Workers trapped inside." } },
    // ROAD ACCIDENT
    { reporter: "karim", title: "Multi-Vehicle Collision on Airport Road", desc: "BRTC bus collided with CNG auto-rickshaw near Airport Road flyover. 8 injured, 2 critical. Traffic backed up 3km to Kuril. Ambulance and police on scene. Injured being taken to United Hospital.", type: IncidentType.ROAD_ACCIDENT, loc: "Airport Road, Dhaka", lat: 23.8310, lng: 90.4225, status: IncidentStatus.PUBLISHED, ago: hoursAgo(2) },
    { reporter: "monir", title: "Tongi Train-Microbus Collision", desc: "Freight train hit microbus at ungated level crossing in Tongi Bazar area. 4 dead including 2 children, 3 critically injured. Bangladesh Railway investigating. Crossing had no barrier or guard.", type: IncidentType.ROAD_ACCIDENT, loc: "Tongi Bazar, Gazipur", lat: 23.9300, lng: 90.4010, status: IncidentStatus.PUBLISHED, ago: hoursAgo(1) },
    // VIOLENCE
    { reporter: "nusrat", title: "Mugging at Banani Road-11", desc: "Group of muggers targeting pedestrians after dark on Banani Road 11 near Gulshan-2 circle. Two victims robbed at knifepoint in last 2 days. Police patrol increased but incidents continuing.", type: IncidentType.VIOLENCE, loc: "Banani Road 11, Dhaka", lat: 23.7940, lng: 90.4080, status: IncidentStatus.PUBLISHED, ago: hoursAgo(2) },
    { reporter: "jamal", title: "Political Clash at Shahbag", desc: "Clashes between two political groups near Shahbag intersection. Brick-throwing, vehicles vandalized. Police firing tear gas to disperse crowds. Dhaka University area locked down. 15 arrested.", type: IncidentType.VIOLENCE, loc: "Shahbag, Dhaka", lat: 23.7381, lng: 90.3953, status: IncidentStatus.PUBLISHED, ago: hoursAgo(5) },
    // MEDICAL
    { reporter: "nasreen", title: "Elderly Man Collapsed in Dhanmondi", desc: "Elderly man collapsed near Dhanmondi Lake amphitheater. Bystanders performing CPR. Ambulance needed urgently. No pulse detected for 2 minutes. Possible cardiac arrest.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Dhanmondi Lake, Dhaka", lat: 23.7465, lng: 90.3750, status: IncidentStatus.PUBLISHED, ago: hoursAgo(1) },
    { reporter: "salma", title: "Dengue Outbreak in Rampura", desc: "30 confirmed dengue cases in Rampura West area in last 7 days. 3 hospitalized in critical condition at Dhaka Medical College Hospital. DGHS fogging campaign launched. Aedes mosquito breeding sites found in construction sites.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Rampura, Dhaka", lat: 23.7635, lng: 90.4251, status: IncidentStatus.PUBLISHED, ago: hoursAgo(20) },
    // EARTHQUAKE
    { reporter: "tanvir", title: "Earthquake Tremors in Sylhet", desc: "Strong tremors felt across Sylhet city and surrounding tea gardens. Buildings shaking for 15 seconds. Widespread panic. No immediate reports of damage. USGS reports 5.2 magnitude, epicenter 80km northeast in Meghalaya.", type: IncidentType.EARTHQUAKE, loc: "Zindabazar, Sylhet", lat: 24.8949, lng: 91.8687, status: IncidentStatus.PUBLISHED, ago: minsAgo(20) },
    // UNDER_REVIEW / SPAM
    { reporter: "farhan", title: "Unverified Activity Near Hatirjheel", desc: "Something happening near Hatirjheel bridge but not confirmed what. Loud noises heard. Possibly construction or firework. Need verification.", type: IncidentType.OTHER, loc: "Hatirjheel, Dhaka", lat: 23.7733, lng: 90.4150, status: IncidentStatus.UNDER_REVIEW, ago: minsAgo(30) },
    { reporter: "farhan", title: "FREE GOLD AT MOTIJHEEL", desc: "CLICK HERE TO GET FREE GOLD COINS. GOVERNMENT DISTRIBUTION. CALL NOW 01900000000.", type: IncidentType.OTHER, loc: "Motijheel, Dhaka", lat: 23.7330, lng: 90.4172, status: IncidentStatus.UNDER_REVIEW, ago: minsAgo(5) },
  ];

  const reports: Record<string, any> = {};
  for (let i = 0; i < reportDefs.length; i++) {
    const r = reportDefs[i];
    reports[`r${i}`] = await prisma.incidentReport.create({
      data: {
        reporterId: users[r.reporter].id,
        incidentTitle: r.title,
        description: r.desc,
        incidentType: r.type,
        locationText: r.loc,
        latitude: r.lat,
        longitude: r.lng,
        mediaFilenames: [],
        sourceAudioFilename: r.voice?.audio ?? null,
        detectedLanguage: r.voice?.lang ?? null,
        languageProbability: r.voice?.prob ?? null,
        translatedDescription: r.voice?.translated ?? null,
        // AI fields left as placeholders — Phase 2 (seed-ai.ts) will populate with real AI
        credibilityScore: 50,
        severityLevel: IncidentSeverity.MEDIUM,
        classifiedIncidentType: r.type,
        classifiedIncidentTitle: r.title,
        spamFlagged: false,
        status: r.status,
        createdAt: r.ago,
      },
    });
  }
  console.log(`  ${reportDefs.length} incident reports\n`);

  // ── Volunteer-submitted published reports (for trust tier promotion) ──
  // These ensure volunteers have verifiedReportCount > 0 so the
  // REPORTER → TRAINEE promotion path (30 pts + 1 report) triggers naturally.
  console.log("Creating volunteer-submitted reports...");
  const volReportDefs: Array<{
    reporter: string; title: string; desc: string;
    type: IncidentType; loc: string; lat: number; lng: number;
    sev: IncidentSeverity; ago: Date;
  }> = [
    { reporter: "ayesha", title: "Banani Area Flooding - Water Rising", desc: "Street flooding in Banani Block H. Water entering ground floor apartments. Elderly residents need evacuation assistance.", type: IncidentType.FLOOD, loc: "Banani, Dhaka", lat: 23.7940, lng: 90.4080, sev: IncidentSeverity.HIGH, ago: hoursAgo(5) },
    { reporter: "kamrul", title: "Medical Camp Overflow in Mirpur", desc: "Red Cross medical camp in Mirpur-10 overwhelmed. 200+ patients waiting. Need additional doctors and supplies.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, sev: IncidentSeverity.HIGH, ago: hoursAgo(4) },
    { reporter: "rashida", title: "Shelter Shortage at Dhanmondi", desc: "Emergency shelter at Dhanmondi Lake Park at capacity. 50+ families still arriving. Need tents and food.", type: IncidentType.FLOOD, loc: "Dhanmondi, Dhaka", lat: 23.7466, lng: 90.3736, sev: IncidentSeverity.MEDIUM, ago: hoursAgo(3) },
    { reporter: "harun", title: "Supply Truck Stuck on Airport Road", desc: "Relief supply truck stuck in floodwater on Airport Road. Cargo includes dry food and water purification tablets.", type: IncidentType.FLOOD, loc: "Airport Road, Dhaka", lat: 23.8310, lng: 90.4225, sev: IncidentSeverity.MEDIUM, ago: hoursAgo(2) },
    { reporter: "farzana", title: "Hospital Overflow in Gulshan", desc: "United Hospital ER at full capacity after building collapse casualties. Redirecting minor injuries to nearby clinics.", type: IncidentType.MEDICAL_EMERGENCY, loc: "Gulshan, Dhaka", lat: 23.7948, lng: 90.4143, sev: IncidentSeverity.CRITICAL, ago: hoursAgo(2) },
    { reporter: "masud", title: "Boat Rescue Needed in Chattogram", desc: "5 families stranded in Chattogram port area. Water level rising. Need boat rescue immediately.", type: IncidentType.FLOOD, loc: "Chattogram Port", lat: 22.3480, lng: 91.7635, sev: IncidentSeverity.CRITICAL, ago: hoursAgo(6) },
  ];

  for (let i = 0; i < volReportDefs.length; i++) {
    const r = volReportDefs[i];
    reports[`vr${i}`] = await prisma.incidentReport.create({
      data: {
        reporterId: volunteers[r.reporter].id,
        incidentTitle: r.title,
        description: r.desc,
        incidentType: r.type,
        locationText: r.loc,
        latitude: r.lat,
        longitude: r.lng,
        mediaFilenames: [],
        credibilityScore: 50, // Phase 2 will update with AI
        severityLevel: r.sev,
        classifiedIncidentType: r.type,
        classifiedIncidentTitle: r.title,
        spamFlagged: false,
        status: IncidentStatus.PUBLISHED,
        createdAt: r.ago,
      },
    });
  }
  console.log(`  ${volReportDefs.length} volunteer-submitted reports\n`);

  // ════════════════════════════════════════════════════════════
  // 3. CRISIS EVENTS + LINKS
  // ════════════════════════════════════════════════════════════
  console.log("Creating crisis events...");

  const crisisDefs: Array<{
    title: string; type: IncidentType; sev: IncidentSeverity;
    loc: string; lat: number; lng: number; status: CrisisEventStatus;
    sitRep: string; reportKeys: string[]; ago: Date; canonicalId: string;
  }> = [
    { title: "Mirpur Monsoon Flooding", type: IncidentType.FLOOD, sev: IncidentSeverity.CRITICAL, loc: "Mirpur, Dhaka", lat: 23.8075, lng: 90.3688, status: CrisisEventStatus.RESPONSE_IN_PROGRESS, sitRep: "Severe flooding across Mirpur sections 10-12. Water levels 5+ feet. Multiple families stranded. Boat rescue operations underway. 3 shelters opened.", reportKeys: ["r0", "r1"], ago: hoursAgo(6), canonicalId: "FLOOD-2026-0001" },
    { title: "Khulna Riverside Flood", type: IncidentType.FLOOD, sev: IncidentSeverity.CRITICAL, loc: "Khulna", lat: 22.8350, lng: 89.5500, status: CrisisEventStatus.REPORTED, sitRep: "Rupsha River breached danger level. 500+ families displaced. Army deployed for evacuation.", reportKeys: ["r2"], ago: hoursAgo(10), canonicalId: "FLOOD-2026-0002" },
    { title: "Sylhet Flash Flood", type: IncidentType.FLOOD, sev: IncidentSeverity.CRITICAL, loc: "Sylhet", lat: 24.9100, lng: 91.8500, status: CrisisEventStatus.RESPONSE_IN_PROGRESS, sitRep: "Flash flood from Meghalaya hills. Highway inundated. 2000+ people stranded. Army rescue active.", reportKeys: ["r3", "r15"], ago: hoursAgo(8), canonicalId: "FLOOD-2026-0003" },
    { title: "Tejgaon Chemical Fire", type: IncidentType.FIRE, sev: IncidentSeverity.HIGH, loc: "Tejgaon, Dhaka", lat: 23.7585, lng: 90.3930, status: CrisisEventStatus.CONTAINED, sitRep: "Warehouse fire 80% contained. Toxic smoke advisory in effect for 2km radius. Schools closed.", reportKeys: ["r5"], ago: hoursAgo(12), canonicalId: "FIRE-2026-0001" },
    { title: "Agrabad Factory Fire", type: IncidentType.FIRE, sev: IncidentSeverity.HIGH, loc: "Chattogram", lat: 22.3267, lng: 91.8127, status: CrisisEventStatus.RESOLVED, sitRep: "Fire fully extinguished. All workers accounted for. 5 minor injuries. Factory sealed pending inspection.", reportKeys: ["r6"], ago: hoursAgo(14), canonicalId: "FIRE-2026-0002" },
    { title: "Sadarghat Building Collapse", type: IncidentType.BUILDING_COLLAPSE, sev: IncidentSeverity.CRITICAL, loc: "Sadarghat, Dhaka", lat: 23.7080, lng: 90.4050, status: CrisisEventStatus.RESPONSE_IN_PROGRESS, sitRep: "4-story factory collapsed. 25 rescued alive, 4 dead. NDRF teams using heavy equipment.", reportKeys: ["r8"], ago: hoursAgo(3), canonicalId: "COLLAPSE-2026-0001" },
    { title: "Tongi Train Collision", type: IncidentType.ROAD_ACCIDENT, sev: IncidentSeverity.CRITICAL, loc: "Tongi, Gazipur", lat: 23.9300, lng: 90.4010, status: CrisisEventStatus.REPORTED, sitRep: "Freight train hit microbus at ungated crossing. 4 dead, 3 critical. Railway investigation underway.", reportKeys: ["r10"], ago: hoursAgo(1), canonicalId: "ACCIDENT-2026-0001" },
    { title: "Shahbag Political Violence", type: IncidentType.VIOLENCE, sev: IncidentSeverity.HIGH, loc: "Shahbag, Dhaka", lat: 23.7381, lng: 90.3953, status: CrisisEventStatus.CONTAINED, sitRep: "Police dispersed both groups. 15 arrests. Shahbag reopened with heavy police presence.", reportKeys: ["r12"], ago: hoursAgo(5), canonicalId: "VIOLENCE-2026-0001" },
    { title: "Rampura Dengue Outbreak", type: IncidentType.MEDICAL_EMERGENCY, sev: IncidentSeverity.HIGH, loc: "Rampura, Dhaka", lat: 23.7635, lng: 90.4251, status: CrisisEventStatus.REPORTED, sitRep: "30 confirmed dengue cases. DGHS fogging campaign launched. Blood bank reserves low.", reportKeys: ["r14"], ago: hoursAgo(20), canonicalId: "MEDICAL-2026-0001" },
  ];

  const crises: Record<string, any> = {};
  for (let i = 0; i < crisisDefs.length; i++) {
    const c = crisisDefs[i];
    crises[`c${i}`] = await prisma.crisisEvent.create({
      data: {
        canonicalId: c.canonicalId,
        title: c.title,
        incidentType: c.type,
        severityLevel: c.sev,
        locationText: c.loc,
        latitude: c.lat,
        longitude: c.lng,
        status: c.status,
        sitRepText: c.sitRep,
        reportCount: c.reportKeys.length,
        reporterCount: new Set(c.reportKeys.map(k => reports[k]?.reporterId)).size,
        createdAt: c.ago,
      },
    });
    for (const rk of c.reportKeys) {
      if (reports[rk]) {
        await prisma.crisisEventReport.create({
          data: { crisisEventId: crises[`c${i}`].id, incidentReportId: reports[rk].id },
        });
      }
    }
  }
  console.log(`  ${crisisDefs.length} crisis events\n`);

  // ════════════════════════════════════════════════════════════
  // 4. CRISIS EVENT UPDATES (Timeline)
  // ════════════════════════════════════════════════════════════
  console.log("Creating crisis timeline updates...");

  const updateDefs: Array<{
    crisis: string; updater: string; prev: CrisisEventStatus; next: CrisisEventStatus;
    note: string; type: CrisisUpdateType; ver: CrisisUpdateVerificationStatus;
    sev?: IncidentSeverity; area?: string; access?: CrisisAccessStatus;
    casualties?: number; displaced?: number; ago: Date;
  }> = [
    // Mirpur Flood (c0)
    { crisis: "c0", updater: "rahim", prev: CrisisEventStatus.REPORTED, next: CrisisEventStatus.VERIFIED, note: "Confirmed flooding in Mirpur 10-12. Multiple eyewitness reports corroborated.", type: CrisisUpdateType.STATUS_CHANGE, ver: CrisisUpdateVerificationStatus.CORROBORATED, ago: hoursAgo(5) },
    { crisis: "c0", updater: "admin", prev: CrisisEventStatus.VERIFIED, next: CrisisEventStatus.RESPONSE_IN_PROGRESS, note: "NDRF teams deployed. 3 relief shelters opened at local schools. Boat rescue operations active.", type: CrisisUpdateType.STATUS_CHANGE, ver: CrisisUpdateVerificationStatus.COORDINATOR_VERIFIED, ago: hoursAgo(4), displaced: 500 },
    { crisis: "c0", updater: "ayesha", prev: CrisisEventStatus.RESPONSE_IN_PROGRESS, next: CrisisEventStatus.RESPONSE_IN_PROGRESS, note: "On-site: 3 families rescued from Building 7. Water level 6 feet. No casualties. All transferred to Mirpur shelter.", type: CrisisUpdateType.FIELD_OBSERVATION, ver: CrisisUpdateVerificationStatus.RESPONDER_CONFIRMED, ago: hoursAgo(2), access: CrisisAccessStatus.LIMITED },
    // Sadarghat Collapse (c5)
    { crisis: "c5", updater: "arif", prev: CrisisEventStatus.REPORTED, next: CrisisEventStatus.VERIFIED, note: "Confirmed building collapse. 4-story garment factory. Cracks reported yesterday.", type: CrisisUpdateType.STATUS_CHANGE, ver: CrisisUpdateVerificationStatus.CORROBORATED, ago: hoursAgo(3) },
    { crisis: "c5", updater: "admin", prev: CrisisEventStatus.VERIFIED, next: CrisisEventStatus.RESPONSE_IN_PROGRESS, note: "NDRF heavy equipment deployed. 25 workers rescued alive, 4 confirmed dead. Blood donation appeal issued.", type: CrisisUpdateType.STATUS_CHANGE, ver: CrisisUpdateVerificationStatus.COORDINATOR_VERIFIED, ago: hoursAgo(2), casualties: 4 },
    // Tejgaon Fire (c3)
    { crisis: "c3", updater: "sumaiya", prev: CrisisEventStatus.REPORTED, next: CrisisEventStatus.RESPONSE_IN_PROGRESS, note: "Fire confirmed at chemical warehouse. 5 fire units on scene. Adjacent buildings evacuating.", type: CrisisUpdateType.STATUS_CHANGE, ver: CrisisUpdateVerificationStatus.CORROBORATED, ago: hoursAgo(11) },
    { crisis: "c3", updater: "admin", prev: CrisisEventStatus.RESPONSE_IN_PROGRESS, next: CrisisEventStatus.CONTAINED, note: "Fire 80% contained. Toxic smoke advisory for 2km radius. Schools closed early.", type: CrisisUpdateType.STATUS_CHANGE, ver: CrisisUpdateVerificationStatus.COORDINATOR_VERIFIED, ago: hoursAgo(6), access: CrisisAccessStatus.LIMITED },
  ];

  for (const u of updateDefs) {
    const updaterId = u.updater === "admin" ? admin1.id : (users[u.updater]?.id ?? volunteers[u.updater]?.id ?? admin1.id);
    await prisma.crisisEventUpdate.create({
      data: {
        crisisEventId: crises[u.crisis].id,
        updaterId,
        previousStatus: u.prev,
        newStatus: u.next,
        updateNote: u.note,
        updateType: u.type,
        verificationStatus: u.ver,
        newSeverity: u.sev ?? null,
        affectedArea: u.area ?? null,
        accessStatus: u.access ?? null,
        casualtyCount: u.casualties ?? null,
        displacedCount: u.displaced ?? null,
        createdAt: u.ago,
      },
    });
  }
  console.log(`  ${updateDefs.length} timeline updates\n`);

  // ════════════════════════════════════════════════════════════
  // 5. CRISIS RESPONDERS (Opt-in)
  // ════════════════════════════════════════════════════════════
  console.log("Creating crisis responders...");

  const responderDefs = [
    { crisis: "c0", vol: "ayesha", status: CrisisResponderStatus.ON_SITE },
    { crisis: "c0", vol: "rashida", status: CrisisResponderStatus.RESPONDING },
    { crisis: "c0", vol: "harun", status: CrisisResponderStatus.EN_ROUTE },
    { crisis: "c5", vol: "farzana", status: CrisisResponderStatus.ON_SITE },
    { crisis: "c5", vol: "ayesha", status: CrisisResponderStatus.RESPONDING },
    { crisis: "c3", vol: "masud", status: CrisisResponderStatus.COMPLETED },
  ];

  for (const r of responderDefs) {
    await prisma.crisisResponder.create({
      data: {
        crisisEventId: crises[r.crisis].id,
        volunteerId: volunteers[r.vol].id,
        status: r.status,
        optedInAt: hoursAgo(5),
        lastStatusAt: hoursAgo(1),
      },
    });
  }
  console.log(`  ${responderDefs.length} responder records\n`);

  // ════════════════════════════════════════════════════════════
  // 6. REVIEWS
  // ════════════════════════════════════════════════════════════
  console.log("Creating volunteer reviews...");

  const contexts = [InteractionContext.RESCUE_OPERATION, InteractionContext.MEDICAL_AID, InteractionContext.SUPPLY_DISTRIBUTION, InteractionContext.SHELTER_MANAGEMENT, InteractionContext.OTHER];
  const posTexts = [
    "Excellent work during the relief operation. Professional and timely.",
    "Outstanding rescue skills. Saved 3 families from flooded homes.",
    "Great leadership during shelter setup. Kept everyone organized.",
    "Very helpful with food distribution. Ensured elderly and children served first.",
    "Excellent medical first aid. Treated multiple injured before ambulances arrived.",
    "Arrived on time, worked tirelessly for 12 hours. Genuine compassion.",
  ];
  const negTexts = [
    "Showed up 3 hours late and left early. Did not complete assigned tasks.",
    "Was rude to beneficiaries. Created unnecessary tension.",
    "Did not follow safety protocols. Put others at risk.",
    "Disappeared from relief site for hours without informing anyone.",
  ];

  const reviewerPool = [users.farhan, users.rahim, users.karim, users.nasreen, users.jamal, users.sumaiya, users.arif, users.fatema, users.rafiq, users.salma];
  let reviewCount = 0;

  // Ayesha — 8 positive reviews
  for (let i = 0; i < 8; i++) {
    await prisma.review.create({
      data: { reviewerId: reviewerPool[i % reviewerPool.length].id, volunteerId: volunteers.ayesha.id, rating: pick([4, 5, 5, 5]), text: posTexts[i % posTexts.length], interactionContext: contexts[i % contexts.length], interactionDate: daysAgo(5 + i * 3), wouldWorkAgain: true, crisisEventId: crises.c0.id, createdAt: daysAgo(5 + i * 3) },
    });
    reviewCount++;
  }
  // Kamrul — 6 reviews
  for (let i = 0; i < 6; i++) {
    await prisma.review.create({
      data: { reviewerId: reviewerPool[(i + 2) % reviewerPool.length].id, volunteerId: volunteers.kamrul.id, rating: pick([3, 4, 4, 5]), text: posTexts[(i + 3) % posTexts.length], interactionContext: contexts[i % contexts.length], interactionDate: daysAgo(8 + i * 4), wouldWorkAgain: true, crisisEventId: crises.c0.id, createdAt: daysAgo(8 + i * 4) },
    });
    reviewCount++;
  }
  // Rashida — 5 reviews
  for (let i = 0; i < 5; i++) {
    await prisma.review.create({
      data: { reviewerId: reviewerPool[(i + 4) % reviewerPool.length].id, volunteerId: volunteers.rashida.id, rating: pick([4, 4, 5, 5]), text: posTexts[(i + 6) % posTexts.length], interactionContext: contexts[i % contexts.length], interactionDate: daysAgo(4 + i * 3), wouldWorkAgain: true, crisisEventId: crises.c0.id, createdAt: daysAgo(4 + i * 3) },
    });
    reviewCount++;
  }
  // Farzana — 5 reviews
  for (let i = 0; i < 5; i++) {
    await prisma.review.create({
      data: { reviewerId: reviewerPool[(i + 6) % reviewerPool.length].id, volunteerId: volunteers.farzana.id, rating: pick([4, 5, 5]), text: posTexts[(i + 2) % posTexts.length], interactionContext: pick([InteractionContext.MEDICAL_AID, InteractionContext.RESCUE_OPERATION]), interactionDate: daysAgo(3 + i * 4), wouldWorkAgain: true, crisisEventId: crises.c5.id, createdAt: daysAgo(3 + i * 4) },
    });
    reviewCount++;
  }
  // Masud — 4 reviews
  for (let i = 0; i < 4; i++) {
    await prisma.review.create({
      data: { reviewerId: reviewerPool[(i + 8) % reviewerPool.length].id, volunteerId: volunteers.masud.id, rating: pick([4, 4, 5]), text: posTexts[(i + 8) % posTexts.length], interactionContext: pick([InteractionContext.RESCUE_OPERATION, InteractionContext.OTHER]), interactionDate: daysAgo(7 + i * 5), wouldWorkAgain: true, crisisEventId: crises.c3.id, createdAt: daysAgo(7 + i * 5) },
    });
    reviewCount++;
  }
  // Billal — 5 negative reviews (flagged)
  for (let i = 0; i < 5; i++) {
    await prisma.review.create({
      data: { reviewerId: reviewerPool[(i + 1) % reviewerPool.length].id, volunteerId: volunteers.billal.id, rating: pick([1, 1, 2]), text: negTexts[i % negTexts.length], interactionContext: contexts[i % contexts.length], interactionDate: daysAgo(3 + i * 4), wouldWorkAgain: false, crisisEventId: crises.c0.id, createdAt: daysAgo(3 + i * 4) },
    });
    reviewCount++;
  }
  console.log(`  ${reviewCount} reviews\n`);

  // ════════════════════════════════════════════════════════════
  // 7. RESOURCES + RESERVATIONS
  // ════════════════════════════════════════════════════════════
  console.log("Creating resources...");

  const resourceDefs: Array<{
    name: string; cat: string; qty: number; unit: string; cond: string;
    addr: string; lat: number; lng: number; contact: string; notes: string;
    status: string; owner: string;
  }> = [
    { name: "First Aid Kits", cat: "Medical Supplies", qty: 25, unit: "kits", cond: "New", addr: "Banani Road 12, Dhaka", lat: 23.7937, lng: 90.4066, contact: "Phone", notes: "Bandages, antiseptics, pain relievers, splints, CPR masks", status: "Available", owner: "farhan" },
    { name: "Drinking Water (1L bottles)", cat: "Food & Water", qty: 500, unit: "bottles", cond: "New", addr: "Gulshan-1 Community Center, Dhaka", lat: 23.7808, lng: 90.4167, contact: "SMS", notes: "Sealed 1-liter bottles. Ready for distribution.", status: "Available", owner: "jamal" },
    { name: "Rice (10kg bags)", cat: "Food & Water", qty: 150, unit: "bags", cond: "New", addr: "Mirpur DOHS, Dhaka", lat: 23.8103, lng: 90.4125, contact: "Phone", notes: "Miniket rice, sealed packaging.", status: "Available", owner: "rahim" },
    { name: "Winter Blankets", cat: "Clothing", qty: 100, unit: "pieces", cond: "Good", addr: "Dhanmondi Road 27, Dhaka", lat: 23.7466, lng: 90.3736, contact: "In-App", notes: "Warm woolen blankets, cleaned.", status: "Available", owner: "nasreen" },
    { name: "Family Tents", cat: "Shelter", qty: 20, unit: "tents", cond: "Good", addr: "Baridhara DOHS, Dhaka", lat: 23.7925, lng: 90.4101, contact: "Phone", notes: "4-person capacity, waterproof.", status: "Available", owner: "karim" },
    { name: "Portable Generator (5kW)", cat: "Tools & Equipment", qty: 3, unit: "units", cond: "Good", addr: "Bashundhara, Dhaka", lat: 23.8167, lng: 90.4303, contact: "Phone", notes: "Diesel-powered, 8-hour runtime.", status: "Available", owner: "karim" },
    { name: "Ambulance Van", cat: "Transportation", qty: 1, unit: "vehicle", cond: "Good", addr: "Mohammadpur, Dhaka", lat: 23.7662, lng: 90.3589, contact: "Phone", notes: "Stretcher, oxygen, basic medical equipment. Driver available 24/7.", status: "Available", owner: "nasreen" },
    { name: "Inflatable Rescue Boats", cat: "Tools & Equipment", qty: 4, unit: "boats", cond: "Good", addr: "Mirpur Fire Station, Dhaka", lat: 23.7956, lng: 90.3537, contact: "Phone", notes: "6-person capacity with oars and life vests. Currently deployed in Mirpur.", status: "Low Stock", owner: "rahim" },
    { name: "Life Jackets", cat: "Tools & Equipment", qty: 35, unit: "pieces", cond: "Good", addr: "Sadarghat Terminal, Dhaka", lat: 23.7080, lng: 90.4050, contact: "In-App", notes: "Adult and child sizes.", status: "Available", owner: "arif" },
    { name: "Water Purification Tablets", cat: "Medical Supplies", qty: 2000, unit: "tablets", cond: "New", addr: "Tejgaon, Dhaka", lat: 23.7583, lng: 90.3928, contact: "Phone", notes: "Aquatabs - each tablet purifies 1 liter. WHO approved.", status: "Available", owner: "sumaiya" },
    { name: "ORS Saline Packets", cat: "Medical Supplies", qty: 500, unit: "packets", cond: "New", addr: "Farmgate, Dhaka", lat: 23.7570, lng: 90.3876, contact: "Phone", notes: "WHO standard oral rehydration salts.", status: "Available", owner: "fatema" },
    { name: "Tarpaulin Sheets", cat: "Shelter", qty: 60, unit: "sheets", cond: "New", addr: "UN Warehouse, Savar", lat: 23.8460, lng: 90.2566, contact: "Phone", notes: "Heavy-duty 12x16 feet.", status: "Available", owner: "farhan" },
    { name: "LED Flashlights", cat: "Tools & Equipment", qty: 0, unit: "sets", cond: "New", addr: "Niketan, Dhaka", lat: 23.7833, lng: 90.4167, contact: "In-App", notes: "All distributed during Mirpur flood. Awaiting restock.", status: "Depleted", owner: "jamal" },
    { name: "Mosquito Nets", cat: "Medical Supplies", qty: 200, unit: "pieces", cond: "New", addr: "Rampura, Dhaka", lat: 23.7635, lng: 90.4251, contact: "In-App", notes: "Long-lasting insecticidal nets for dengue prevention.", status: "Available", owner: "salma" },
    { name: "Oxygen Cylinders", cat: "Medical Supplies", qty: 5, unit: "cylinders", cond: "Good", addr: "Jatrabari Health Complex", lat: 23.7100, lng: 90.4316, contact: "Phone", notes: "D-size portable with mask and regulator.", status: "Available", owner: "arif" },
  ];

  const resources: Record<string, any> = {};
  for (let i = 0; i < resourceDefs.length; i++) {
    const r = resourceDefs[i];
    resources[`res${i}`] = await prisma.resource.create({
      data: {
        name: r.name,
        category: r.cat,
        quantity: r.qty,
        originalQuantity: r.qty,
        unit: r.unit,
        condition: r.cond,
        address: r.addr,
        latitude: r.lat,
        longitude: r.lng,
        contactPreference: r.contact,
        notes: r.notes,
        status: r.status,
        userId: users[r.owner].id,
      },
    });
  }
  console.log(`  ${resourceDefs.length} resources\n`);

  // ── Reservations ──
  console.log("Creating reservations...");
  const reservationDefs = [
    { res: "res0", user: "ayesha", qty: 5, status: "Approved", reason: "First aid kits for Mirpur flood rescue operations", pickup: daysAhead(1) },
    { res: "res1", user: "rashida", qty: 50, status: "Approved", reason: "Water bottles for shelter distribution", pickup: daysAhead(1) },
    { res: "res2", user: "harun", qty: 20, status: "Pending", reason: "Rice bags for relief camp", pickup: daysAhead(2) },
    { res: "res3", user: "farzana", qty: 100, status: "Pending", reason: "ORS packets for medical camp at Sadarghat", pickup: daysAhead(1) },
    { res: "res4", user: "masud", qty: 2, status: "Declined", reason: "Rescue boats for Sylhet operation", pickup: null, decisionReason: "Boats already deployed in Mirpur. Will restock soon." },
    { res: "res5", user: "ayesha", qty: 10, status: "Expired", reason: "Life jackets for training exercise", pickup: null },
  ];

  for (const r of reservationDefs) {
    const vol = volunteers[r.user];
    await prisma.reservation.create({
      data: {
        userId: vol.id,
        resourceId: resources[r.res].id,
        quantity: r.qty,
        status: r.status,
        justification: r.reason,
        pickupTime: r.pickup,
        decisionReason: r.decisionReason ?? null,
        createdAt: daysAgo(2),
      },
    });
  }
  console.log(`  ${reservationDefs.length} reservations\n`);

  // ════════════════════════════════════════════════════════════
  // 8. SECURE FOLDERS + FILES + NOTES + SHARE LINKS
  // ════════════════════════════════════════════════════════════
  console.log("Creating secure folders...");

  const f1 = await prisma.secureFolder.create({ data: { name: "Mirpur Flood Rescue Evidence", description: "Photos and field notes from Mirpur flood rescue", crisisId: crises.c0.id, ownerId: users.farhan.id, isPinned: true } });
  await prisma.folderFile.createMany({ data: [
    { folderId: f1.id, uploaderId: users.farhan.id, fileName: "mirpur_rescue_boat.jpg", fileUrl: "/uploads/docs/mirpur_rescue_boat.jpg", fileType: "image/jpeg", sizeBytes: 2458624, gpsLat: 23.8070, gpsLng: 90.3680 },
    { folderId: f1.id, uploaderId: users.farhan.id, fileName: "mirpur_water_level.jpg", fileUrl: "/uploads/docs/mirpur_water_level.jpg", fileType: "image/jpeg", sizeBytes: 3145728, gpsLat: 23.8085, gpsLng: 90.3695 },
    { folderId: f1.id, uploaderId: users.rahim.id, fileName: "mirpur_rescue_video.mp4", fileUrl: "/uploads/docs/mirpur_rescue_video.mp4", fileType: "video/mp4", sizeBytes: 15728640, gpsLat: 23.8075, gpsLng: 90.3688 },
  ]});
  await prisma.folderNote.createMany({ data: [
    { folderId: f1.id, authorId: users.farhan.id, content: "3 families rescued from Building 7. Water level 6 feet. Inflatable boat used. No casualties. All transferred to Mirpur shelter.", gpsLat: 23.8070, gpsLng: 90.3680 },
    { folderId: f1.id, authorId: users.rahim.id, content: "Relief distribution complete: 50kg rice, 30L water, 15 blankets, 10 first aid kits. Priority given to elderly and children.", gpsLat: 23.8085, gpsLng: 90.3695 },
  ]});
  await prisma.shareLink.create({ data: { folderId: f1.id, token: "share_mirpur_flood_demo_abc", expiresAt: daysAhead(7) } });

  const f2 = await prisma.secureFolder.create({ data: { name: "Sadarghat Collapse Investigation", description: "Structural assessment and rescue documentation", crisisId: crises.c5.id, ownerId: users.arif.id } });
  await prisma.folderFile.createMany({ data: [
    { folderId: f2.id, uploaderId: users.arif.id, fileName: "sadarghat_overview.jpg", fileUrl: "/uploads/docs/sadarghat_overview.jpg", fileType: "image/jpeg", sizeBytes: 4194304, gpsLat: 23.7080, gpsLng: 90.4050 },
    { folderId: f2.id, uploaderId: users.arif.id, fileName: "structural_report.pdf", fileUrl: "/uploads/docs/structural_report.pdf", fileType: "application/pdf", sizeBytes: 1048576 },
  ]});
  await prisma.folderNote.create({ data: { folderId: f2.id, authorId: users.arif.id, content: "Initial assessment: 4-story building, east side completely collapsed. 25 workers rescued alive, 4 dead. RAJUK confirms adjacent buildings safe.", gpsLat: 23.7080, gpsLng: 90.4050 } });
  await prisma.shareLink.create({ data: { folderId: f2.id, token: "share_sadarghat_collapse_xyz", expiresAt: daysAhead(14) } });

  const f3 = await prisma.secureFolder.create({ data: { name: "Volunteer Training Records", description: "CPR, water rescue, and first aid training documentation", ownerId: volunteers.ayesha.id } });
  await prisma.folderFile.createMany({ data: [
    { folderId: f3.id, uploaderId: volunteers.ayesha.id, fileName: "cpr_training.jpg", fileUrl: "/uploads/docs/cpr_training.jpg", fileType: "image/jpeg", sizeBytes: 1843200, gpsLat: 23.7937, gpsLng: 90.4066 },
  ]});
  await prisma.folderNote.create({ data: { folderId: f3.id, authorId: volunteers.ayesha.id, content: "Training completed: 20 volunteers certified in CPR, water rescue, and first aid. Duration: 8 hours.", gpsLat: 23.7937, gpsLng: 90.4066 } });
  await prisma.shareLink.create({ data: { folderId: f3.id, token: "share_training_demo_docs", expiresAt: daysAhead(30) } });

  // Archived folder
  await prisma.secureFolder.create({ data: { name: "Archived 2025 Assessment", description: "Previous year records - archived", ownerId: users.arif.id, isDeleted: true, deletedAt: daysAgo(14) } });

  console.log("  4 folders (1 archived), 6 files, 4 notes, 3 share links\n");

  // ════════════════════════════════════════════════════════════
  // 9. EVIDENCE POSTS + FLAGS
  // ════════════════════════════════════════════════════════════
  console.log("Creating evidence posts...");

  const evidenceDefs = [
    { user: "ayesha", crisis: "c0", title: "Mirpur Rescue Operation Photo", desc: "Boat rescue of 3 families from Building 7, Section 10.", loc: "Mirpur-10, Dhaka", lat: 23.8070, lng: 90.3680, media: ["/uploads/evidence/mirpur_rescue.jpg"], mediaType: "IMAGE", verified: true },
    { user: "farzana", crisis: "c5", title: "Sadarghat Medical Triage", desc: "On-site triage of rescued workers. 5 minor injuries treated.", loc: "Sadarghat, Dhaka", lat: 23.7080, lng: 90.4050, media: ["/uploads/evidence/sadarghat_triage.jpg"], mediaType: "IMAGE", verified: true },
    { user: "rashida", crisis: "c0", title: "Shelter Setup at Mirpur School", desc: "Relief shelter operational at Mirpur-10 Government Primary School. Capacity 200.", loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, media: ["/uploads/evidence/mirpur_shelter.jpg"], mediaType: "IMAGE", verified: false },
    { user: "masud", crisis: "c3", title: "Tejgaon Fire Containment", desc: "Fire 80% contained. Firefighters treated for smoke inhalation.", loc: "Tejgaon, Dhaka", lat: 23.7583, lng: 90.3928, media: ["/uploads/evidence/tejgaon_fire.mp4"], mediaType: "VIDEO", verified: true },
    { user: "farhan", crisis: null, title: "Community Preparedness Drill", desc: "Neighborhood emergency preparedness drill in Mohakhali.", loc: "Mohakhali, Dhaka", lat: 23.7785, lng: 90.4065, media: ["/uploads/evidence/drill.jpg"], mediaType: "IMAGE", verified: false },
  ];

  for (let i = 0; i < evidenceDefs.length; i++) {
    const e = evidenceDefs[i];
    const userId = volunteers[e.user]?.id ?? users[e.user].id;
    await prisma.evidencePost.create({
      data: {
        userId,
        crisisEventId: e.crisis ? crises[e.crisis].id : null,
        title: e.title,
        description: e.desc,
        location: e.loc,
        latitude: e.lat,
        longitude: e.lng,
        mediaUrls: e.media,
        mediaType: e.mediaType,
        isVerified: e.verified,
        visibility: MediaVisibility.REDACTED_PUBLIC,
        createdAt: hoursAgo(5 - i),
      },
    });
  }

  // Flag on one evidence post
  const allEvidence = await prisma.evidencePost.findMany({ take: 1, orderBy: { createdAt: "desc" } });
  if (allEvidence[0]) {
    await prisma.evidenceFlag.create({
      data: { postId: allEvidence[0].id, userId: users.rahim.id, reason: "Image appears to be from a different location than claimed." },
    });
  }
  console.log(`  ${evidenceDefs.length} evidence posts, 1 flag\n`);

  // ════════════════════════════════════════════════════════════
  // 10. VOLUNTEER TASKS (Timesheet)
  // ════════════════════════════════════════════════════════════
  console.log("Creating volunteer tasks...");

  const taskDefs = [
    { vol: "ayesha", title: "Mirpur Boat Rescue", desc: "Rescued 3 families from flooded building using inflatable boat.", cat: TaskCategory.RESCUE, hours: 6, crisis: "c0", status: TaskStatus.VERIFIED, points: 60, verifier: "admin" },
    { vol: "ayesha", title: "Shelter Management", desc: "Managed relief shelter at Mirpur School for 12 hours.", cat: TaskCategory.SHELTER_SETUP, hours: 12, crisis: "c0", status: TaskStatus.VERIFIED, points: 120, verifier: "admin" },
    { vol: "ayesha", title: "First Aid Training Session", desc: "Conducted CPR training for 20 new volunteers.", cat: TaskCategory.OTHER, hours: 8, crisis: null, status: TaskStatus.PENDING, points: 0 },
    { vol: "rashida", title: "Food Distribution", desc: "Distributed food packets to 100 families in Mirpur.", cat: TaskCategory.SUPPLY_DISTRIBUTION, hours: 5, crisis: "c0", status: TaskStatus.VERIFIED, points: 50, verifier: "admin" },
    { vol: "farzana", title: "Medical Triage at Sadarghat", desc: "Treated 5 injured workers at building collapse site.", cat: TaskCategory.MEDICAL_AID, hours: 4, crisis: "c5", status: TaskStatus.VERIFIED, points: 40, verifier: "admin" },
    { vol: "farzana", title: "Oxygen Administration", desc: "Administered oxygen to 2 critically injured workers.", cat: TaskCategory.MEDICAL_AID, hours: 2, crisis: "c5", status: TaskStatus.PENDING, points: 0 },
    { vol: "masud", title: "Tejgaon Fire Response", desc: "Assisted fire service with perimeter control and evacuation.", cat: TaskCategory.RESCUE, hours: 6, crisis: "c3", status: TaskStatus.VERIFIED, points: 60, verifier: "admin" },
    { vol: "kamrul", title: "Counseling Flood Victims", desc: "Provided trauma counseling to 15 affected individuals.", cat: TaskCategory.COUNSELING, hours: 4, crisis: "c0", status: TaskStatus.VERIFIED, points: 40, verifier: "admin" },
    { vol: "harun", title: "Supply Transport", desc: "Transported relief supplies from warehouse to Mirpur shelter.", cat: TaskCategory.TRANSPORTATION, hours: 3, crisis: "c0", status: TaskStatus.REJECTED, points: 0, verifier: "admin", rejectionReason: "Unable to verify - no evidence of completion provided." },
    { vol: "rashida", title: "Shelter Setup", desc: "Set up temporary shelter at Khulna cyclone center.", cat: TaskCategory.SHELTER_SETUP, hours: 5, crisis: "c1", status: TaskStatus.PENDING, points: 0 },
  ];

  for (const t of taskDefs) {
    await prisma.volunteerTask.create({
      data: {
        volunteerId: volunteers[t.vol].id,
        title: t.title,
        description: t.desc,
        category: t.cat,
        hoursSpent: t.hours,
        dateOfTask: daysAgo(Math.floor(Math.random() * 10) + 1),
        crisisEventId: t.crisis ? crises[t.crisis].id : null,
        status: t.status,
        pointsAwarded: t.points,
        verifiedById: t.verifier === "admin" ? admin1.id : null,
        verifiedAt: t.status === TaskStatus.VERIFIED ? daysAgo(1) : null,
        rejectionReason: t.rejectionReason ?? null,
        createdAt: daysAgo(Math.floor(Math.random() * 10) + 2),
      },
    });
  }
  console.log(`  ${taskDefs.length} volunteer tasks\n`);

  // ════════════════════════════════════════════════════════════
  // 11. BADGES
  // ════════════════════════════════════════════════════════════
  console.log("Creating badges...");

  const badgeDefs = [
    { vol: "ayesha", type: BadgeType.FIRST_RESPONDER },
    { vol: "ayesha", type: BadgeType.CRISIS_HERO },
    { vol: "ayesha", type: BadgeType.ELITE_VOLUNTEER },
    { vol: "farzana", type: BadgeType.FIRST_RESPONDER },
    { vol: "farzana", type: BadgeType.RISING_STAR },
    { vol: "rashida", type: BadgeType.COMMUNITY_GUARDIAN },
    { vol: "masud", type: BadgeType.FIRST_RESPONDER },
    { vol: "kamrul", type: BadgeType.TEAM_PLAYER },
  ];

  for (const b of badgeDefs) {
    await prisma.badge.create({
      data: { userId: volunteers[b.vol].id, badgeType: b.type, awardedAt: daysAgo(Math.floor(Math.random() * 30) + 1) },
    });
  }
  console.log(`  ${badgeDefs.length} badges\n`);

  // ════════════════════════════════════════════════════════════
  // 12. NOTIFICATIONS + SUBSCRIPTIONS
  // ════════════════════════════════════════════════════════════
  console.log("Creating notifications and subscriptions...");

  // Subscriptions
  await prisma.notificationSubscription.create({ data: { userId: users.farhan.id, incidentTypes: [IncidentType.FLOOD, IncidentType.FIRE, IncidentType.BUILDING_COLLAPSE], radiusKm: 15, isActive: true } });
  await prisma.notificationSubscription.create({ data: { userId: users.rahim.id, incidentTypes: [IncidentType.FLOOD], radiusKm: 10, isActive: true } });
  await prisma.notificationSubscription.create({ data: { userId: volunteers.ayesha.id, incidentTypes: [IncidentType.FLOOD, IncidentType.FIRE, IncidentType.BUILDING_COLLAPSE, IncidentType.MEDICAL_EMERGENCY], radiusKm: 20, isActive: true } });

  // Notifications
  const notifDefs = [
    { user: "farhan", crisis: "c0", title: "Flood Alert: Mirpur Area", body: "Severe flooding reported in Mirpur-10. Avoid the area. Move to higher ground.", type: NotificationType.CRISIS_ALERT, read: false, ago: hoursAgo(5) },
    { user: "farhan", crisis: "c5", title: "Building Collapse: Sadarghat", body: "Building collapse reported in Sadarghat, Old Dhaka. Rescue operations underway.", type: NotificationType.CRISIS_ALERT, read: false, ago: hoursAgo(2) },
    { user: "farhan", crisis: null, title: "Reservation Approved", body: "Your reservation for 5 First Aid Kits has been approved.", type: NotificationType.RESERVATION_APPROVED, read: true, ago: daysAgo(1) },
    { user: "rahim", crisis: "c0", title: "Flood Update: Mirpur", body: "Rescue operations in progress. 3 shelters opened at local schools.", type: NotificationType.CRISIS_UPDATE, read: false, ago: hoursAgo(3) },
    { user: "ayesha", crisis: "c0", title: "Dispatch Alert: Mirpur Flood", body: "Your help is needed for flood rescue in Mirpur-10. Report to Mirpur Fire Station.", type: NotificationType.DISPATCH_ALERT, read: false, ago: hoursAgo(4) },
    { user: "ayesha", crisis: "c5", title: "Dispatch Alert: Sadarghat", body: "Medical volunteers needed at Sadarghat collapse site. Report immediately.", type: NotificationType.DISPATCH_ALERT, read: true, ago: hoursAgo(2) },
    { user: "rashida", crisis: null, title: "Reservation Request", body: "A volunteer has requested 50 water bottles from your resource listing.", type: NotificationType.RESERVATION_REQUEST, read: false, ago: daysAgo(2) },
    { user: "admin", crisis: "c8", title: "NGO Report Prompt", body: "Rampura Dengue Outbreak has been reported. Trigger an NGO summary report.", type: NotificationType.NGO_REPORT_PROMPT, read: false, ago: hoursAgo(18) },
  ];

  for (const n of notifDefs) {
    const userId = n.user === "admin" ? admin1.id : (users[n.user]?.id ?? volunteers[n.user]?.id);
    await prisma.notification.create({
      data: {
        userId,
        crisisEventId: n.crisis ? crises[n.crisis].id : null,
        title: n.title,
        body: n.body,
        survivalInstruction: n.crisis ? "PENDING_AI_GENERATION" : null, // Phase 2 will generate AI instructions
        isRead: n.read,
        deliveryState: NotificationDeliveryState.DELIVERED,
        type: n.type,
        channel: "IN_APP",
        createdAt: n.ago,
      },
    });
  }
  console.log(`  ${notifDefs.length} notifications, 3 subscriptions\n`);

  // ════════════════════════════════════════════════════════════
  // 13. CLAIMS + EVIDENCE EDGES (Evidence Graph)
  // ════════════════════════════════════════════════════════════
  console.log("Creating claims and evidence edges...");

  const claimDefs = [
    { crisis: "c0", type: ClaimType.ROAD_ACCESS, subject: "Mirpur Section 10 Main Road", value: "Impassable", loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, state: EvidenceState.CORROBORATED, support: 3, conflict: 0, report: "r0", creator: "rahim" },
    { crisis: "c0", type: ClaimType.CASUALTY_ESTIMATE, subject: "Mirpur Flood Casualties", value: "0 confirmed, 500 displaced", loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, state: EvidenceState.PARTIALLY_CORROBORATED, support: 2, conflict: 0, report: "r0", creator: "rahim" },
    { crisis: "c0", type: ClaimType.RESOURCE_NEED, subject: "Mirpur Shelter Supplies", value: "50 blankets, 100 water bottles, 20 first aid kits", loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, state: EvidenceState.COORDINATOR_VERIFIED, support: 4, conflict: 0, report: "r1", creator: "shakil" },
    { crisis: "c0", type: ClaimType.HAZARD_STATUS, subject: "Mirpur Water Contamination", value: "Sewage overflow - water contaminated", loc: "Mirpur-10, Dhaka", lat: 23.8069, lng: 90.3687, state: EvidenceState.SINGLE_SOURCE, support: 1, conflict: 0, report: "r1", creator: "shakil" },
    { crisis: "c5", type: ClaimType.CASUALTY_ESTIMATE, subject: "Sadarghat Collapse Casualties", value: "4 dead, 25 rescued", loc: "Sadarghat, Dhaka", lat: 23.7080, lng: 90.4050, state: EvidenceState.OFFICIAL_CONFIRMED, support: 5, conflict: 0, report: "r8", creator: "arif" },
    { crisis: "c5", type: ClaimType.DAMAGE_ASSESSMENT, subject: "Sadarghat Building Structure", value: "East wing completely collapsed, west wing intact", loc: "Sadarghat, Dhaka", lat: 23.7080, lng: 90.4050, state: EvidenceState.COORDINATOR_VERIFIED, support: 3, conflict: 0, report: "r8", creator: "arif" },
    { crisis: "c3", type: ClaimType.HAZARD_STATUS, subject: "Tejgaon Air Quality", value: "Toxic smoke - respiratory hazard within 2km", loc: "Tejgaon, Dhaka", lat: 23.7583, lng: 90.3928, state: EvidenceState.CORROBORATED, support: 3, conflict: 0, report: "r5", creator: "sumaiya" },
  ];

  const claims: Record<string, any> = {};
  for (let i = 0; i < claimDefs.length; i++) {
    const c = claimDefs[i];
    claims[`cl${i}`] = await prisma.claim.create({
      data: {
        claimType: c.type,
        subject: c.subject,
        value: c.value,
        locationText: c.loc,
        latitude: c.lat,
        longitude: c.lng,
        crisisEventId: crises[c.crisis].id,
        incidentReportId: reports[c.report]?.id ?? null,
        evidenceState: c.state,
        needsHumanDecision: c.state === EvidenceState.SINGLE_SOURCE,
        supportCount: c.support,
        conflictCount: c.conflict,
        createdById: users[c.creator].id,
        createdAt: hoursAgo(5 - i),
      },
    });
  }

  // Evidence edges — one CONTRADICTS edge to show conflict detection
  await prisma.evidenceEdge.create({
    data: {
      fromClaimId: claims.cl3.id,
      toClaimId: claims.cl1.id,
      edgeType: EvidenceEdgeType.CONTRADICTS,
      reason: "Hazard claim about water contamination contradicts casualty estimate of 0 casualties - contamination may cause health casualties.",
      createdById: admin1.id,
    },
  });

  // SUPPORTS edge
  await prisma.evidenceEdge.create({
    data: {
      fromClaimId: claims.cl0.id,
      toClaimId: claims.cl1.id,
      edgeType: EvidenceEdgeType.SUPPORTS,
      reason: "Road impassability supports casualty estimate - limited access delays rescue.",
      createdById: admin1.id,
    },
  });

  console.log(`  ${claimDefs.length} claims, 2 evidence edges\n`);

  // ════════════════════════════════════════════════════════════
  // 14. NEEDS + ASSIGNMENTS + ALLOCATIONS
  // ════════════════════════════════════════════════════════════
  console.log("Creating needs, assignments, and allocations...");

  const needDefs = [
    { crisis: "c0", type: "Rescue Boats", desc: "2 inflatable rescue boats for Mirpur flood", qty: 2, unit: "boats", urgency: "CRITICAL", met: false, claim: "cl2" },
    { crisis: "c0", type: "Medical Supplies", desc: "First aid kits and ORS for shelter", qty: 50, unit: "kits", urgency: "HIGH", met: false, claim: "cl2" },
    { crisis: "c0", type: "Clean Water", desc: "Drinking water for 500 displaced people", qty: 500, unit: "bottles", urgency: "HIGH", met: false, claim: "cl2" },
    { crisis: "c5", type: "Medical Team", desc: "Doctors and nurses for collapse site triage", qty: 1, unit: "team", urgency: "CRITICAL", met: false, claim: "cl4" },
    { crisis: "c5", type: "Heavy Equipment", desc: "Crane and cutting tools for debris removal", qty: 2, unit: "units", urgency: "CRITICAL", met: true, claim: "cl5" },
  ];

  const needs: Record<string, any> = {};
  for (let i = 0; i < needDefs.length; i++) {
    const n = needDefs[i];
    needs[`n${i}`] = await prisma.need.create({
      data: {
        crisisEventId: crises[n.crisis].id,
        needType: n.type,
        description: n.desc,
        quantity: n.qty,
        unit: n.unit,
        urgency: n.urgency,
        isMet: n.met,
        sourceClaimId: claims[n.claim]?.id ?? null,
        createdAt: hoursAgo(4),
      },
    });
  }

  // Assignments
  const assignmentDefs = [
    { need: "n0", crisis: "c0", vol: "ayesha", status: AssignmentStatus.COMPLETED, proposer: "admin" },
    { need: "n1", crisis: "c0", vol: "farzana", status: AssignmentStatus.ACCEPTED, proposer: "admin" },
    { need: "n2", crisis: "c0", vol: "rashida", status: AssignmentStatus.OFFERED, proposer: "admin" },
    { need: "n3", crisis: "c5", vol: "farzana", status: AssignmentStatus.ON_SITE, proposer: "admin" },
    { need: null, crisis: "c0", vol: "harun", status: AssignmentStatus.PROPOSED, proposer: "admin" },
  ];

  for (const a of assignmentDefs) {
    await prisma.assignment.create({
      data: {
        crisisEventId: crises[a.crisis].id,
        needId: a.need ? needs[a.need].id : null,
        volunteerId: volunteers[a.vol].id,
        status: a.status,
        proposedById: admin1.id,
        proposedAt: hoursAgo(4),
        acceptedAt: a.status === AssignmentStatus.ACCEPTED || a.status === AssignmentStatus.ON_SITE || a.status === AssignmentStatus.COMPLETED ? hoursAgo(3) : null,
        completedAt: a.status === AssignmentStatus.COMPLETED ? hoursAgo(1) : null,
        outcomeNote: a.status === AssignmentStatus.COMPLETED ? "Successfully rescued 3 families. All transferred to shelter." : null,
        outcomeApproved: a.status === AssignmentStatus.COMPLETED,
      },
    });
  }

  // Allocations
  const allocationDefs = [
    { need: "n0", res: "res7", qty: 2, status: AllocationStatus.APPROVED, requester: "ayesha", approver: "admin" },
    { need: "n1", res: "res0", qty: 20, status: AllocationStatus.DELIVERED, requester: "farzana", approver: "admin", deliveryNote: "Delivered to Mirpur shelter." },
    { need: "n2", res: "res1", qty: 100, status: AllocationStatus.READY, requester: "rashida", approver: "admin" },
    { need: "n2", res: "res2", qty: 50, status: AllocationStatus.REQUESTED, requester: "rashida", approver: null },
  ];

  for (const a of allocationDefs) {
    const alloc = await prisma.allocation.create({
      data: {
        needId: needs[a.need].id,
        resourceId: resources[a.res].id,
        quantity: a.qty,
        status: a.status,
        requestedById: volunteers[a.requester].id,
        approvedById: a.approver === "admin" ? admin1.id : null,
        approvedAt: a.approver ? hoursAgo(2) : null,
        deliveredAt: a.status === AllocationStatus.DELIVERED ? hoursAgo(1) : null,
        deliveryNote: a.deliveryNote ?? null,
        createdAt: hoursAgo(3),
      },
    });

    // Fulfillment for delivered allocation
    if (a.status === AllocationStatus.DELIVERED) {
      await prisma.fulfillment.create({
        data: {
          allocationId: alloc.id,
          deliveredQuantity: a.qty,
          recordedById: admin1.id,
          recipientName: "Mirpur Shelter Coordinator",
          verificationNote: "Received and confirmed by shelter manager.",
          createdAt: hoursAgo(1),
        },
      });
    }
  }
  console.log(`  ${needDefs.length} needs, ${assignmentDefs.length} assignments, ${allocationDefs.length} allocations, 1 fulfillment\n`);

  // ════════════════════════════════════════════════════════════
  // 15. OCR SCANS + ITEMS
  // ════════════════════════════════════════════════════════════
  console.log("Creating OCR scans...");

  const scan1 = await prisma.oCRScan.create({
    data: {
      userId: users.farhan.id,
      folderId: f1.id,
      crisisEventId: crises.c0.id,
      sourceImageUrl: "/uploads/ocr/mirpur_water_marker.jpg",
      sourceFileName: "mirpur_water_marker.jpg",
      provider: "tesseract",
      status: "COMPLETED",
      rawText: "WATER LEVEL MARKER\nSection 10, Mirpur\nDate: 15/08/2026\nLevel: 6.2 feet\nDanger Level: 4.0 feet\nStatus: ABOVE DANGER",
      createdAt: hoursAgo(3),
    },
  });
  await prisma.oCRItem.createMany({ data: [
    { scanId: scan1.id, text: "Section 10, Mirpur", confidence: 0.95, category: "LOCATION" },
    { scanId: scan1.id, text: "Date: 15/08/2026", confidence: 0.92, category: "DATE" },
    { scanId: scan1.id, text: "Level: 6.2 feet", confidence: 0.89, category: "MEASUREMENT" },
    { scanId: scan1.id, text: "Danger Level: 4.0 feet", confidence: 0.91, category: "MEASUREMENT" },
    { scanId: scan1.id, text: "Status: ABOVE DANGER", confidence: 0.97, category: "STATUS" },
  ]});

  const scan2 = await prisma.oCRScan.create({
    data: {
      userId: users.arif.id,
      folderId: f2.id,
      crisisEventId: crises.c5.id,
      sourceImageUrl: "/uploads/ocr/sadarghat_notice.jpg",
      sourceFileName: "sadarghat_notice.jpg",
      provider: "tesseract",
      status: "COMPLETED",
      rawText: "RAJUK BUILDING INSPECTION NOTICE\nBuilding: 4-story Garment Factory\nLocation: Sadarghat, Old Dhaka\nInspection Date: 14/08/2026\nStatus: CRACKS OBSERVED - EVACUATION RECOMMENDED",
      createdAt: hoursAgo(2),
    },
  });
  await prisma.oCRItem.createMany({ data: [
    { scanId: scan2.id, text: "Building: 4-story Garment Factory", confidence: 0.93, category: "BUILDING_INFO" },
    { scanId: scan2.id, text: "Location: Sadarghat, Old Dhaka", confidence: 0.96, category: "LOCATION" },
    { scanId: scan2.id, text: "Status: CRACKS OBSERVED - EVACUATION RECOMMENDED", confidence: 0.88, category: "STATUS" },
  ]});

  console.log("  2 OCR scans with items\n");

  // ════════════════════════════════════════════════════════════
  // 16. NGO REPORTS — Created in Phase 2 (seed-ai.ts) with AI-generated sections
  // ════════════════════════════════════════════════════════════
  console.log("Skipping NGO reports (AI-generated in Phase 2)...\n");

  // ════════════════════════════════════════════════════════════
  // 17. DISPATCH ALERT LOGS
  // ════════════════════════════════════════════════════════════
  console.log("Creating dispatch alert logs...");

  await prisma.dispatchAlertLog.create({
    data: { userId: volunteers.ayesha.id, crisisEventId: crises.c0.id, emailMasked: "ay****@core.local", status: DispatchAlertStatus.SENT, createdAt: hoursAgo(4) },
  });
  await prisma.dispatchAlertLog.create({
    data: { userId: volunteers.farzana.id, crisisEventId: crises.c5.id, emailMasked: "fa****@core.local", status: DispatchAlertStatus.SENT, createdAt: hoursAgo(2) },
  });
  await prisma.dispatchAlertLog.create({
    data: { userId: volunteers.rashida.id, crisisEventId: crises.c0.id, emailMasked: "ra****@core.local", status: DispatchAlertStatus.SENT, createdAt: hoursAgo(4) },
  });
  console.log("  3 dispatch alert logs\n");

  // ════════════════════════════════════════════════════════════
  // 18. AFTER ACTION REPORT — Created in Phase 2 (seed-ai.ts) with AI-generated sections
  // ════════════════════════════════════════════════════════════
  console.log("Skipping after-action report (AI-generated in Phase 2)...\n");

  // ════════════════════════════════════════════════════════════
  // 19. SITUATION BRIEF — Created in Phase 2 (seed-ai.ts) with AI-enhanced content
  // ════════════════════════════════════════════════════════════
  console.log("Skipping situation brief (AI-generated in Phase 2)...\n");

  // ════════════════════════════════════════════════════════════
  // 20. ACTION DRAFTS (Copilot proposals pending coordinator review)
  // ════════════════════════════════════════════════════════════
  console.log("Creating action drafts...");

  const draftDefs = [
    {
      crisis: "c0",
      draftType: "DISPATCH",
      payload: { volunteerId: volunteers.ayesha.id, role: "RESCUE_BOAT", area: "Mirpur-10" },
      reasoning: "Eyewitness reports confirm 3 families stranded in Building 7, Mirpur-10. Ayesha is the nearest approved responder with boat rescue certification. Dispatch recommended for immediate evacuation.",
      sourceIds: [claims.cl0.id, claims.cl1.id],
      status: "PENDING",
    },
    {
      crisis: "c0",
      draftType: "ALLOCATION",
      payload: { resourceType: "Clean Water", quantity: 500, unit: "liters", destination: "Mirpur Shelter 1" },
      reasoning: "500+ people displaced across 3 shelters. Water contamination confirmed by field report. Allocate 500L clean water from central stockpile to Mirpur Shelter 1 immediately.",
      sourceIds: [claims.cl2.id],
      status: "PENDING",
    },
    {
      crisis: "c5",
      draftType: "STATUS_CHANGE",
      payload: { fromStatus: "RESPONSE_IN_PROGRESS", toStatus: "CONTAINED" },
      reasoning: "NDRF reports 25 rescued, 4 dead. Search operations 90% complete with no signs of additional survivors. Recommend transitioning to contained status and beginning after-action preparation.",
      sourceIds: [claims.cl4?.id].filter(Boolean) as string[],
      status: "PENDING",
    },
    {
      crisis: "c0",
      draftType: "ALERT",
      payload: { alertType: "WATER_CONTAMINATION", radius: 2, message: "Do not drink tap water in Mirpur 10-12. Boil all water before use." },
      reasoning: "Field test confirms water contamination in flood-affected Mirpur zones. Public health alert recommended for 2km radius to prevent waterborne disease outbreak.",
      sourceIds: [claims.cl2.id, claims.cl3.id],
      status: "CONFIRMED",
      confirmedById: admin1.id,
      confirmedAt: hoursAgo(3),
    },
  ];

  for (const d of draftDefs) {
    await prisma.actionDraft.create({
      data: {
        crisisEventId: crises[d.crisis].id,
        draftType: d.draftType,
        payload: JSON.stringify(d.payload),
        reasoning: d.reasoning,
        sourceIds: d.sourceIds,
        status: d.status as any,
        proposedById: admin1.id,
        confirmedById: d.confirmedById ?? null,
        confirmedAt: d.confirmedAt ?? null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: hoursAgo(2),
      },
    });
  }
  console.log(`  ${draftDefs.length} action drafts\n`);

  // ════════════════════════════════════════════════════════════
  // 21. AUDIT EVENTS (sample)
  // ════════════════════════════════════════════════════════════
  console.log("Creating audit events...");

  const auditDefs = [
    { actor: admin1.id, role: "ADMIN", action: "CRISIS_STATUS_CHANGED", target: "CrisisEvent", targetId: crises.c0.id, reason: "Status changed from REPORTED to RESPONSE_IN_PROGRESS", before: JSON.stringify({ status: "REPORTED" }), after: JSON.stringify({ status: "RESPONSE_IN_PROGRESS" }), ago: hoursAgo(4) },
    { actor: admin1.id, role: "ADMIN", action: "VOLUNTEER_TASK_VERIFIED", target: "VolunteerTask", targetId: "task-001", reason: "Task verified and points awarded", after: JSON.stringify({ pointsAwarded: 60 }), ago: daysAgo(1) },
    { actor: users.farhan.id, role: "USER", action: "INCIDENT_REPORT_CREATED", target: "IncidentReport", targetId: reports.r0.id, reason: "New flood report submitted", ago: hoursAgo(6) },
  ];

  for (const a of auditDefs) {
    await prisma.auditEvent.create({
      data: {
        actorId: a.actor,
        actorRole: a.role,
        action: a.action,
        targetType: a.target,
        targetId: a.targetId,
        reason: a.reason,
        beforeJson: a.before ?? null,
        afterJson: a.after ?? null,
        createdAt: a.ago,
      },
    });
  }
  console.log(`  ${auditDefs.length} audit events\n`);

  // ════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("  LOGIN CREDENTIALS:");
  console.log("");
  console.log("  Admin:");
  console.log("    admin@core.local / Admin@12345");
  console.log("    mizan@core.local / Admin@12345");
  console.log("");
  console.log("  Users (password: User@12345):");
  console.log("    farhan@core.local  — demo user");
  console.log("    rahim@core.local   — reporter in Mirpur");
  console.log("");
  console.log("  Volunteers (password: Volunteer@12345):");
  console.log("    ayesha.vol@core.local  — top volunteer (badges, verified tasks)");
  console.log("    farzana.vol@core.local — nurse, medical responder");
  console.log("    rashida.vol@core.local — shelter management");
  console.log("    billal.vol@core.local  — FLAGGED volunteer");
  console.log("    munira.vol@core.local  — new volunteer, no reviews");
  console.log("");
  console.log("  DATA SUMMARY:");
  console.log(`    ${reportDefs.length} incident reports (pending AI classification)`);
  console.log(`    ${crisisDefs.length} crisis events`);
  console.log(`    ${updateDefs.length} timeline updates`);
  console.log(`    ${responderDefs.length} crisis responders`);
  console.log(`    ${reviewCount} volunteer reviews`);
  console.log(`    ${resourceDefs.length} resources, ${reservationDefs.length} reservations`);
  console.log(`    4 secure folders (1 archived), 6 files, 4 notes, 3 share links`);
  console.log(`    ${evidenceDefs.length} evidence posts, 1 flag`);
  console.log(`    ${taskDefs.length} volunteer tasks`);
  console.log(`    ${badgeDefs.length} badges`);
  console.log(`    ${notifDefs.length} notifications (pending AI survival instructions), 3 subscriptions`);
  console.log(`    ${claimDefs.length} base claims, 2 evidence edges`);
  console.log(`    ${needDefs.length} needs, ${assignmentDefs.length} assignments, ${allocationDefs.length} allocations`);
  console.log(`    2 OCR scans, 3 dispatch alerts`);
  console.log(`    NGO reports, situation briefs, copilot Q&A — AI-generated in Phase 2`);
  console.log("");
  console.log("  NEXT: Run `npx tsx prisma/seed-ai.ts` to generate AI responses");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
