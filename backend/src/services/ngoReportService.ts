import fs from "node:fs";
import path from "node:path";

import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma.js";

type ManualReportData = {
  assignedVolunteers?: string[];
  resources?: { name: string; amount: string }[];
};

type ReportSection = {
  title: string;
  body: () => void;
};

export async function generateNGOReportPDF(
  crisisId: string,
  adminId: string,
  manualData: ManualReportData = {},
  existingReportId?: string
) {
  const data = await aggregateCrisisData(crisisId, manualData);

  if (!["RESOLVED", "CLOSED"].includes(data.crisis.status)) {
    throw new Error("NGO reports can only be generated for resolved or closed crises");
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { fullName: true }
  });

  const reportsDir = path.resolve(process.cwd(), "uploads", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `NGO_Report_${crisisId}_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, filename);
  const doc = new PDFDocument({ margin: 50, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  renderCoverPage(doc, data.crisis, admin?.fullName ?? "Admin");

  const sections: ReportSection[] = [
    { title: "Executive Summary", body: () => renderParagraph(doc, data.crisis.sitRepText || "No AI situation summary is available for this crisis.") },
    { title: "Incident Details", body: () => renderIncidentDetails(doc, data.crisis) },
    { title: "Timeline of Events", body: () => renderTimeline(doc, data.crisis.updates) },
    { title: "Resource Utilization", body: () => renderResources(doc, data.manualResources, data.nearbyResources) },
    { title: "Volunteer Involvement", body: () => renderVolunteers(doc, data.responders, data.volunteerTasks, data.manualVolunteers) },
    { title: "Visual Evidence Summary", body: () => renderEvidence(doc, data.evidence) },
    { title: "Impact Assessment", body: () => renderImpact(doc, data.latestImpactUpdate) },
    { title: "Appendix: OCR & Document Data", body: () => renderOcrAppendix(doc, data.ocrScans, data.documentFolders) }
  ];

  sections.forEach((section) => {
    doc.addPage();
    renderSectionTitle(doc, section.title);
    section.body();
  });

  renderFooter(doc);
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", async () => {
      const report = existingReportId
        ? await prisma.nGOReport.update({
            where: { id: existingReportId },
            data: {
              fileUrl: `/uploads/reports/${filename}`,
              summary: data.crisis.sitRepText
            },
            include: {
              crisisEvent: { select: { title: true } },
              generatedBy: { select: { fullName: true } }
            }
          })
        : await prisma.nGOReport.create({
            data: {
              crisisEventId: crisisId,
              generatedById: adminId,
              title: `NGO Report: ${data.crisis.title}`,
              fileUrl: `/uploads/reports/${filename}`,
              summary: data.crisis.sitRepText
            },
            include: {
              crisisEvent: { select: { title: true } },
              generatedBy: { select: { fullName: true } }
            }
          });
      resolve(report);
    });
    stream.on("error", reject);
  });
}

export async function ensureNGOReportFile(reportId: string) {
  const report = await prisma.nGOReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error("Report not found");
  }

  const filePath = resolveReportPath(report.fileUrl);
  if (fs.existsSync(filePath)) {
    return report;
  }

  return generateNGOReportPDF(
    report.crisisEventId,
    report.generatedById,
    {},
    report.id
  );
}

export async function listNGOReports(crisisId?: string) {
  return prisma.nGOReport.findMany({
    where: crisisId ? { crisisEventId: crisisId } : {},
    include: {
      crisisEvent: { select: { title: true } },
      generatedBy: { select: { fullName: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getNGOReportById(reportId: string) {
  return prisma.nGOReport.findUnique({
    where: { id: reportId },
    include: {
      crisisEvent: { select: { title: true } },
      generatedBy: { select: { fullName: true } }
    }
  });
}

async function aggregateCrisisData(crisisId: string, manualData: ManualReportData) {
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisId },
    include: {
      reports: {
        include: {
          incidentReport: true
        }
      },
      updates: {
        orderBy: { createdAt: "asc" },
        include: {
          updater: { select: { fullName: true, role: true } }
        }
      },
      responders: {
        include: {
          volunteer: {
            select: {
              fullName: true,
              skills: true,
              totalVerifiedHours: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      }
    }
  });

  if (!crisis) {
    throw new Error("Crisis not found");
  }

  const [manualVolunteers, volunteerTasks, evidence, documentFolders, ocrScans, nearbyResources] =
    await Promise.all([
      manualData.assignedVolunteers?.length
        ? prisma.user.findMany({
            where: { id: { in: manualData.assignedVolunteers } },
            select: { id: true, fullName: true, skills: true, totalVerifiedHours: true }
          })
        : Promise.resolve([]),
      prisma.volunteerTask.findMany({
        where: { crisisEventId: crisisId, status: "VERIFIED" },
        include: {
          volunteer: { select: { fullName: true, skills: true } }
        },
        orderBy: { dateOfTask: "asc" }
      }),
      prisma.evidencePost.findMany({
        where: { isVerified: true },
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { fullName: true } }
        }
      }),
      prisma.secureFolder.findMany({
        where: { crisisId, isDeleted: false },
        include: {
          files: { where: { isDeleted: false }, orderBy: { createdAt: "desc" } },
          notes: { where: { isDeleted: false }, orderBy: { createdAt: "desc" } }
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.oCRScan.findMany({
        where: { crisisEventId: crisisId },
        include: { items: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" }
      }),
      listNearbyResources(crisis.latitude, crisis.longitude)
    ]);

  const latestImpactUpdate = [...crisis.updates]
    .reverse()
    .find((update) =>
      update.affectedArea ||
      update.casualtyCount != null ||
      update.displacedCount != null ||
      update.damageNotes
    );

  return {
    crisis,
    manualResources: manualData.resources?.filter((resource) => resource.name.trim()) ?? [],
    manualVolunteers,
    volunteerTasks,
    evidence,
    documentFolders,
    ocrScans,
    nearbyResources,
    responders: crisis.responders,
    latestImpactUpdate
  };
}

async function listNearbyResources(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) {
    return prisma.resource.findMany({
      take: 10,
      orderBy: { updatedAt: "desc" }
    });
  }

  const latDelta = 0.18;
  const lngDelta = 0.18;
  return prisma.resource.findMany({
    where: {
      latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
      longitude: { gte: longitude - lngDelta, lte: longitude + lngDelta }
    },
    take: 10,
    orderBy: { updatedAt: "desc" }
  });
}

function renderCoverPage(doc: PDFKit.PDFDocument, crisis: any, adminName: string) {
  doc.fontSize(24).font("Helvetica-Bold").text("CORE Platform", { align: "center" });
  doc.moveDown(1.5);
  doc.fontSize(28).text("NGO Summary Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(18).font("Helvetica").text(crisis.title, { align: "center" });
  doc.moveDown(2);

  const lastUpdate = crisis.updates.at(-1);
  doc.fontSize(12);
  doc.text(`Event Period: ${formatDate(crisis.createdAt)} - ${formatDate(lastUpdate?.createdAt ?? new Date())}`, { align: "center" });
  doc.text(`Generated Date: ${formatDate(new Date())}`, { align: "center" });
  doc.text(`Generated By: ${adminName}`, { align: "center" });
  doc.moveDown(4);
  doc.fontSize(10).fillColor("#64748b").text("CONFIDENTIAL - Prepared for NGO, government, and donor coordination.", { align: "center" });
  doc.fillColor("#000000");
}

function renderSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text(title);
  doc.moveDown();
  doc.font("Helvetica").fontSize(11).fillColor("#111827");
}

function renderIncidentDetails(doc: PDFKit.PDFDocument, crisis: any) {
  renderKeyValue(doc, "Type", crisis.incidentType);
  renderKeyValue(doc, "Severity", crisis.severityLevel);
  renderKeyValue(doc, "Status", crisis.status);
  renderKeyValue(doc, "Location", crisis.locationText);
  renderKeyValue(doc, "Reports Merged", String(crisis.reportCount));
  doc.moveDown();

  crisis.reports.forEach((link: any, index: number) => {
    const report = link.incidentReport;
    doc.font("Helvetica-Bold").text(`${index + 1}. ${report.incidentTitle}`);
    doc.font("Helvetica").text(report.description || "No description provided.", { indent: 16 });
    renderKeyValue(doc, "Credibility", `${report.credibilityScore}%`, 16);
    doc.moveDown(0.5);
  });
}

function renderTimeline(doc: PDFKit.PDFDocument, updates: any[]) {
  if (updates.length === 0) {
    renderParagraph(doc, "No command timeline entries were recorded.");
    return;
  }

  updates.forEach((update) => {
    doc.font("Helvetica-Bold").text(`${formatDate(update.createdAt)} - ${update.newStatus}`);
    doc.font("Helvetica").text(`Updated by ${update.updater.fullName} (${update.updater.role})`, { indent: 16 });
    doc.text(update.updateNote, { indent: 16 });
    doc.moveDown(0.5);
  });
}

function renderResources(doc: PDFKit.PDFDocument, manualResources: { name: string; amount: string }[], nearbyResources: any[]) {
  if (manualResources.length > 0) {
    doc.font("Helvetica-Bold").text("Allocated / Distributed Resources");
    manualResources.forEach((resource) => {
      doc.font("Helvetica").text(`- ${resource.name}: ${resource.amount}`);
    });
    doc.moveDown();
  }

  doc.font("Helvetica-Bold").text("Current Nearby Resource Stock");
  if (nearbyResources.length === 0) {
    doc.font("Helvetica").text("No nearby resources were found.");
    return;
  }

  nearbyResources.forEach((resource) => {
    doc.font("Helvetica").text(`- ${resource.name}: ${resource.quantity} ${resource.unit} (${resource.status}) at ${resource.address}`);
  });
}

function renderVolunteers(doc: PDFKit.PDFDocument, responders: any[], tasks: any[], manualVolunteers: any[]) {
  const seen = new Set<string>();

  doc.font("Helvetica-Bold").text("Crisis Responders");
  if (responders.length === 0) {
    doc.font("Helvetica").text("No crisis responder records were found.");
  } else {
    responders.forEach((responder) => {
      seen.add(responder.volunteer.fullName);
      doc.font("Helvetica").text(`- ${responder.volunteer.fullName}: ${responder.status}; skills: ${responder.volunteer.skills.join(", ") || "N/A"}`);
    });
  }

  doc.moveDown();
  doc.font("Helvetica-Bold").text("Verified Timesheet Contributions");
  if (tasks.length === 0) {
    doc.font("Helvetica").text("No verified timesheet entries were linked to this crisis.");
  } else {
    tasks.forEach((task) => {
      seen.add(task.volunteer.fullName);
      doc.font("Helvetica").text(`- ${task.volunteer.fullName}: ${task.hoursSpent}h, ${task.category}, ${task.title}`);
    });
  }

  const remainingManual = manualVolunteers.filter((volunteer) => !seen.has(volunteer.fullName));
  if (remainingManual.length > 0) {
    doc.moveDown();
    doc.font("Helvetica-Bold").text("Additional Assigned Volunteers");
    remainingManual.forEach((volunteer) => {
      doc.font("Helvetica").text(`- ${volunteer.fullName}: ${volunteer.skills.join(", ") || "N/A"}`);
    });
  }
}

function renderEvidence(doc: PDFKit.PDFDocument, evidence: any[]) {
  if (evidence.length === 0) {
    renderParagraph(doc, "No verified visual evidence posts were available for this report.");
    return;
  }

  evidence.forEach((post) => {
    doc.font("Helvetica-Bold").text(`${post.title} (${formatDate(post.createdAt)})`);
    doc.font("Helvetica").text(`By ${post.user.fullName} - ${post.location}`, { indent: 16 });
    doc.text(post.description, { indent: 16 });
    if (post.mediaUrls.length > 0) {
      doc.text(`Media: ${post.mediaUrls.join(", ")}`, { indent: 16 });
    }
    doc.moveDown(0.5);
  });
}

function renderImpact(doc: PDFKit.PDFDocument, update: any | undefined) {
  if (!update) {
    renderParagraph(doc, "No structured impact assessment was recorded.");
    return;
  }

  renderKeyValue(doc, "Affected Area", update.affectedArea || "Not specified");
  renderKeyValue(doc, "Casualties", update.casualtyCount == null ? "Not specified" : String(update.casualtyCount));
  renderKeyValue(doc, "Displaced", update.displacedCount == null ? "Not specified" : String(update.displacedCount));
  renderKeyValue(doc, "Damage Notes", update.damageNotes || "Not specified");
}

function renderOcrAppendix(doc: PDFKit.PDFDocument, scans: any[], folders: any[]) {
  if (scans.length === 0 && folders.length === 0) {
    renderParagraph(doc, "No OCR scans or secure documentation folders were linked to this crisis.");
    return;
  }

  if (scans.length > 0) {
    doc.font("Helvetica-Bold").text("Saved OCR Scans");
    scans.forEach((scan) => {
      doc.font("Helvetica-Bold").text(`${scan.sourceFileName} (${formatDate(scan.createdAt)})`);
      scan.items.forEach((item: any) => {
        const confidence = item.confidence == null ? "N/A" : `${Math.round(item.confidence)}%`;
        doc.font("Helvetica").text(`- [${item.category}] ${item.text} (${confidence})`, { indent: 16 });
      });
      doc.moveDown(0.5);
    });
  }

  if (folders.length > 0) {
    doc.moveDown();
    doc.font("Helvetica-Bold").text("Linked Secure Folders");
    folders.forEach((folder) => {
      doc.font("Helvetica-Bold").text(folder.name);
      folder.files.forEach((file: any) => {
        doc.font("Helvetica").text(`- File: ${file.fileName}${file.description ? ` - ${file.description}` : ""}`, { indent: 16 });
      });
      folder.notes.forEach((note: any) => {
        doc.font("Helvetica").text(`- Note: ${note.content}`, { indent: 16 });
      });
      doc.moveDown(0.5);
    });
  }
}

function renderFooter(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fontSize(8).fillColor("#64748b");
    doc.text(`Page ${index + 1} of ${range.count}`, 50, doc.page.height - 50, {
      align: "center",
      width: doc.page.width - 100
    });
    doc.text("CONFIDENTIAL - CORE Platform NGO Summary Report", 50, doc.page.height - 65, {
      align: "center",
      width: doc.page.width - 100
    });
    doc.fillColor("#000000");
  }
}

function renderParagraph(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica").fontSize(11).text(text, { lineGap: 3 });
}

function renderKeyValue(doc: PDFKit.PDFDocument, key: string, value: string, indent = 0) {
  doc.font("Helvetica-Bold").text(`${key}: `, { continued: true, indent });
  doc.font("Helvetica").text(value);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function resolveReportPath(fileUrl: string) {
  const relative = fileUrl.replace(/^\/+/, "");
  const resolved = path.resolve(process.cwd(), relative);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");

  if (!resolved.startsWith(uploadsRoot)) {
    throw new Error("Invalid report file path");
  }

  return resolved;
}
