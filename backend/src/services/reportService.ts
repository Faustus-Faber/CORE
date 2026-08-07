import type {
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Prisma
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { SafeError } from "../utils/SafeError.js";
import {
  classifyIncidentText,
  type TextAnalysisResult
} from "./textAnalysisClient.js";
import {
  submitVoiceReport,
  type VoiceInputFile,
  type VoiceReportResult
} from "./voiceReportClient.js";
import { clusterReportIntoCrisisEvent } from "./dashboardService.js";
import { extractClaimsFromText, persistClaims } from "./claimService.js";
import {
  clampCredibilityScore,
  severityRanking,
  toIncidentSeverity,
  toIncidentType
} from "../utils/incidentMapping.js";
import {
  buildReporterMap,
  fetchReporters
} from "../utils/reporterLookup.js";

type UploadedFileMeta = {
  originalname: string;
  mimetype: string;
  size: number;
};

export type CreateIncidentReportInput = {
  reporterId: string;
  incidentTitle: string;
  description: string;
  incidentType: IncidentType | string;
  locationText: string;
  latitude?: number | null;
  longitude?: number | null;
  mediaFiles: UploadedFileMeta[];
  voiceFile?: (VoiceInputFile & { size: number }) | undefined;
  aiConsent?: boolean;
};

type PersistedReportSummary = Pick<IncidentReport, "id">;

export type CreateIncidentReportDependencies = {
  submitVoiceReport: (file: VoiceInputFile) => Promise<VoiceReportResult>;
  classifyIncidentText: (text: string, latitude?: number | null, longitude?: number | null) => Promise<TextAnalysisResult>;
  createReportRecord: (data: Omit<IncidentReport, "id">) => Promise<PersistedReportSummary>;
};

type ReportListScope = "community" | "mine" | "under_review";
type ReportSortBy = "createdAt" | "severity" | "credibility";
type ReportSortOrder = "asc" | "desc";
type SeverityFilter = IncidentSeverity | "ALL";

type BaseListInput = {
  search: string;
  severity: SeverityFilter;
  sortBy: ReportSortBy;
  order: ReportSortOrder;
  page: number;
  limit: number;
};

export type ListIncidentReportsInput = BaseListInput & {
  viewerId: string;
  scope: ReportListScope;
};

export type ListUnderReviewIncidentReportsInput = BaseListInput;

type ReportRecordForList = Pick<
  IncidentReport,
  | "id"
  | "reporterId"
  | "incidentTitle"
  | "classifiedIncidentTitle"
  | "description"
  | "locationText"
  | "mediaFilenames"
  | "credibilityScore"
  | "severityLevel"
  | "status"
  | "spamFlagged"
  | "incidentType"
  | "classifiedIncidentType"
  | "createdAt"
>;

export type IncidentReportListItem = {
  id: string;
  reporterId: string;
  reporterName: string;
  isMine: boolean;
  incidentTitle: string;
  classifiedIncidentTitle: string;
  incidentType: IncidentType;
  classifiedIncidentType: IncidentType;
  description: string;
  locationText: string;
  mediaFilenames: string[];
  credibilityScore: number;
  severityLevel: IncidentSeverity;
  status: IncidentStatus;
  spamFlagged: boolean;
  createdAt: string;
};

export type ListIncidentReportsDependencies = {
  listReports: (input: {
    viewerId: string;
    scope: ReportListScope;
    severity: SeverityFilter;
    search?: string;
    sortBy?: ReportSortBy;
    order?: ReportSortOrder;
    skip?: number;
    take?: number;
  }) => Promise<ReportRecordForList[]>;
  listUsers: (userIds: string[]) => Promise<Array<{ id: string; fullName: string }>>;
};

const REPORT_LIST_SELECT = {
  id: true,
  reporterId: true,
  incidentTitle: true,
  classifiedIncidentTitle: true,
  description: true,
  locationText: true,
  mediaFilenames: true,
  credibilityScore: true,
  severityLevel: true,
  status: true,
  spamFlagged: true,
  incidentType: true,
  classifiedIncidentType: true,
  createdAt: true
} as const;

function buildListWhere(scope: ReportListScope, viewerId: string, severity: SeverityFilter): Prisma.IncidentReportWhereInput {
  const where: Prisma.IncidentReportWhereInput = {};

  if (scope === "mine") {
    where.reporterId = viewerId;
  } else if (scope === "community") {
    where.status = "PUBLISHED";
    where.spamFlagged = false;
  } else {
    // Admin triage queue: show reports needing action (under review or clarification requested)
    where.status = { in: ["UNDER_REVIEW", "CLARIFICATION_REQUESTED"] };
  }

  if (severity !== "ALL") {
    where.severityLevel = severity;
  }

  return where;
}

const defaultDependencies: CreateIncidentReportDependencies = {
  submitVoiceReport,
  classifyIncidentText,
  createReportRecord: (data) => prisma.incidentReport.create({ data, select: { id: true } })
};

const severityOrderMap: Record<IncidentSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
} as const;

function buildListOrderBy(sortBy: ReportSortBy, order: ReportSortOrder): Prisma.IncidentReportOrderByWithRelationInput[] {
  const direction = order === "asc" ? "asc" : "desc";
  if (sortBy === "severity") {
    // Severity is an enum, not a number — sort by a derived field is not supported in Prisma.
    // Fall back to createdAt ordering; severity re-sort happens in memory if needed.
    return [{ createdAt: direction }];
  }
  if (sortBy === "credibility") {
    return [{ credibilityScore: direction }];
  }
  return [{ createdAt: direction }];
}

const defaultListDependencies: ListIncidentReportsDependencies = {
  listReports: ({ viewerId, scope, severity, search, sortBy, order, skip, take }) => {
    const where = buildListWhere(scope, viewerId, severity);

    // P1-9: Push search filtering to DB level when possible
    if (search && search.trim()) {
      const needle = search.trim();
      where.OR = [
        { incidentTitle: { contains: needle, mode: "insensitive" } },
        { classifiedIncidentTitle: { contains: needle, mode: "insensitive" } },
        { locationText: { contains: needle, mode: "insensitive" } },
        { description: { contains: needle, mode: "insensitive" } }
      ];
    }

    return prisma.incidentReport.findMany({
      where,
      select: REPORT_LIST_SELECT,
      orderBy: buildListOrderBy(sortBy ?? "createdAt", order ?? "desc"),
      skip: skip ?? 0,
      take: take ?? 50
    });
  },
  listUsers: fetchReporters
};

function matchesSearch(report: ReportRecordForList, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  return [report.incidentTitle, report.classifiedIncidentTitle, report.locationText, report.description]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function compareReports(
  left: ReportRecordForList,
  right: ReportRecordForList,
  sortBy: ReportSortBy,
  order: ReportSortOrder
) {
  let comparison = 0;
  if (sortBy === "severity") {
    comparison = severityRanking[left.severityLevel] - severityRanking[right.severityLevel];
  } else if (sortBy === "credibility") {
    comparison = left.credibilityScore - right.credibilityScore;
  } else {
    comparison = left.createdAt.getTime() - right.createdAt.getTime();
  }
  return order === "asc" ? comparison : -comparison;
}

function toListItem(report: ReportRecordForList, viewerId: string, reporterMap: Map<string, string>): IncidentReportListItem {
  const isMine = report.reporterId === viewerId;
  const reporterName = isMine ? "You" : reporterMap.get(report.reporterId) ?? "Community Member";

  return {
    id: report.id,
    reporterId: report.reporterId,
    reporterName,
    isMine,
    incidentTitle: report.incidentTitle,
    classifiedIncidentTitle: report.classifiedIncidentTitle,
    incidentType: report.incidentType,
    classifiedIncidentType: report.classifiedIncidentType,
    description: report.description,
    locationText: report.locationText,
    mediaFilenames: report.mediaFilenames,
    credibilityScore: report.credibilityScore,
    severityLevel: report.severityLevel,
    status: report.status,
    spamFlagged: report.spamFlagged,
    createdAt: report.createdAt.toISOString()
  };
}

async function paginateAndHydrate(
  reports: ReportRecordForList[],
  input: BaseListInput,
  viewerId: string,
  dependencies: ListIncidentReportsDependencies
): Promise<IncidentReportListItem[]> {
  const filtered = reports
    .filter((report) => matchesSearch(report, input.search))
    .sort((left, right) => compareReports(left, right, input.sortBy, input.order));

  const page = Math.max(1, input.page);
  const limit = Math.max(1, input.limit);
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  const reporterIds = Array.from(new Set(paged.map((report) => report.reporterId)));
  const reporters = await dependencies.listUsers(reporterIds);
  const reporterMap = buildReporterMap(reporters);

  return paged.map((report) => toListItem(report, viewerId, reporterMap));
}

export async function createIncidentReport(
  input: CreateIncidentReportInput,
  dependencies: CreateIncidentReportDependencies = defaultDependencies
) {
  const trimmedTitle = input.incidentTitle.trim();
  const trimmedLocation = input.locationText.trim();

  let description = input.description.trim();
  let voiceMetadata: VoiceReportResult | undefined;

  // P1-14: Only transcribe voice via AI if the user consented to AI processing.
  // Without consent, the voice file is stored but not transcribed automatically.
  // P0-10: Voice transcription failures must NOT block report persistence.
  if (input.voiceFile && input.aiConsent === true) {
    try {
      voiceMetadata = await dependencies.submitVoiceReport(input.voiceFile);
      const translated = voiceMetadata.translated_description?.trim();
      if (translated) {
        description = translated;
      }
    } catch (voiceError) {
      console.error("Voice transcription failed for report from", input.reporterId, voiceError);
      // Report continues with whatever description was provided (may be empty)
      // The voice file is still stored; transcription can be retried later.
    }
  } else if (input.voiceFile) {
    console.info("Voice transcription skipped (aiConsent not granted) for report from", input.reporterId);
  }

  if (!description && !input.voiceFile) {
    throw new SafeError("Description or voice note is required");
  }

  const userSelectedIncidentType = toIncidentType(String(input.incidentType));

  // P0-10: Save the report FIRST with safe defaults, then attempt AI classification.
  // If AI fails, the report is still saved (as UNDER_REVIEW) and can be processed later.
  const now = new Date();
  const created = await dependencies.createReportRecord({
    reporterId: input.reporterId,
    incidentTitle: trimmedTitle,
    description,
    incidentType: userSelectedIncidentType,
    locationText: trimmedLocation,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    mediaFilenames: input.mediaFiles.map((file) => file.originalname),
    sourceAudioFilename: voiceMetadata?.filename ?? input.voiceFile?.originalname ?? null,
    detectedLanguage: voiceMetadata?.detected_language ?? null,
    languageProbability: voiceMetadata?.language_probability ?? null,
    translatedDescription: voiceMetadata?.translated_description ?? null,
    credibilityScore: 50, // neutral default until AI classification completes
    severityLevel: "MEDIUM", // safe default
    classifiedIncidentType: userSelectedIncidentType,
    classifiedIncidentTitle: trimmedTitle,
    spamFlagged: false,
    status: "UNDER_REVIEW", // default to under review until AI confirms
    aiConsent: input.aiConsent ?? false, // P1-14: persist AI processing consent
    createdAt: now,
    updatedAt: now
  });

  // FR-02/P0-10: Return the persisted report immediately. AI classification,
  // clustering, and notifications run asynchronously via processReportAsync.
  return {
    id: created.id,
    incidentTitle: trimmedTitle,
    classifiedIncidentTitle: trimmedTitle,
    severityLevel: "MEDIUM" as IncidentSeverity,
    credibilityScore: 50,
    classifiedIncidentType: userSelectedIncidentType,
    spamFlagged: false,
    status: "UNDER_REVIEW" as IncidentStatus,
    translatedDescription: voiceMetadata?.translated_description ?? null,
    crisisEventId: null,
    // Internal fields for async processing (not exposed to client)
    _async: {
      reportId: created.id,
      description,
      trimmedTitle,
      trimmedLocation,
      userSelectedIncidentType,
      voiceMetadata,
      input
    }
  };
}

/**
 * FR-02: Asynchronous post-persistence processing — AI classification,
 * clustering, and notification dispatch. Called fire-and-forget after
 * the 202 response is sent. Failures do not affect the client.
 */
export async function processReportAsync(
  reportId: string,
  context: {
    description: string;
    trimmedTitle: string;
    trimmedLocation: string;
    userSelectedIncidentType: IncidentType;
    input: CreateIncidentReportInput;
  },
  dependencies: CreateIncidentReportDependencies = defaultDependencies
): Promise<void> {
  const { description, trimmedTitle, trimmedLocation, userSelectedIncidentType, input } = context;

  // P1-14: Respect AI consent — skip AI classification if the user did not consent.
  // The report stays UNDER_REVIEW with neutral defaults until a human moderator reviews it.
  const aiConsentGranted = input.aiConsent === true;

  // Attempt AI classification — failures do not block the report
  let credibilityScore = 50;
  let spamFlagged = false;
  let severityLevel: IncidentSeverity = "MEDIUM";
  let classifiedIncidentType = userSelectedIncidentType;
  let classifiedIncidentTitle = trimmedTitle;
  let aiSucceeded = false;

  if (aiConsentGranted) {
    try {
      const analysis = await dependencies.classifyIncidentText(description, input.latitude, input.longitude);
      credibilityScore = clampCredibilityScore(analysis.credibility_score);
      spamFlagged = analysis.spam_flagged || credibilityScore < 30;
      severityLevel = toIncidentSeverity(analysis.severity_level);
      classifiedIncidentType = toIncidentType(analysis.incident_type);
      classifiedIncidentTitle = analysis.incident_title.trim() || trimmedTitle;
      aiSucceeded = true;
    } catch (error) {
      console.error("AI classification failed for report", reportId, error);
      // Report stays as UNDER_REVIEW with neutral defaults
    }
  } else {
    console.info("AI classification skipped for report", reportId, "(aiConsent not granted)");
  }

  // If AI succeeded, update the report with classified fields
  const status: IncidentStatus = aiSucceeded
    ? (spamFlagged ? "UNDER_REVIEW" : "PUBLISHED")
    : "UNDER_REVIEW";

  if (aiSucceeded) {
    await prisma.incidentReport.update({
      where: { id: reportId },
      data: {
        credibilityScore,
        severityLevel,
        classifiedIncidentType,
        classifiedIncidentTitle,
        spamFlagged,
        status,
        updatedAt: new Date()
      }
    });
  }

  // Only cluster and notify if the report is published (not spam/under review)
  if (status === "PUBLISHED" && !spamFlagged) {
    const clusterResult = await clusterReportAfterCreation(reportId, {
      id: reportId,
      incidentTitle: trimmedTitle,
      description,
      locationText: trimmedLocation,
      incidentType: classifiedIncidentType,
      severityLevel,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      reporterId: input.reporterId,
      spamFlagged
    });

    // Dispatch notifications for the clustered crisis event
    if (clusterResult?.crisisEventId) {
      try {
        const { dispatchNotifications } = await import("./notificationService.js");
        await dispatchNotifications(
          clusterResult.crisisEventId,
          classifiedIncidentType,
          severityLevel,
          classifiedIncidentTitle,
          description,
          input.latitude ?? null,
          input.longitude ?? null
        );
      } catch (err) {
        console.error("[async] Failed to dispatch notifications for report", reportId, err);
      }

      if (severityLevel === "CRITICAL") {
        try {
          const { publishCriticalIncident } = await import("../lib/criticalIncidentStream.js");
          publishCriticalIncident({
            incidentId: clusterResult.crisisEventId,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            occurredAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("[async] Failed to publish critical incident:", err);
        }
      }

      // FR-03: Automatically extract structured claims from the report text
      // and persist them with source record IDs. Failures do not block the
      // report — claims can be extracted manually later.
      // P1-14: Skip AI claim extraction if user did not consent to AI processing.
      if (aiConsentGranted) {
        try {
          const extractedClaims = await extractClaimsFromText(
            reportId,
            description,
            input.reporterId
          );
          if (extractedClaims.length > 0) {
            await persistClaims(
              clusterResult.crisisEventId,
              reportId,
              extractedClaims,
              input.reporterId,
              description
            );
          }
        } catch (err) {
          console.error("[async] Claim extraction failed for report", reportId, err);
        }
      }
    }
  }
}

async function clusterReportAfterCreation(
  reportId: string,
  reportMeta: {
    id: string;
    incidentTitle: string;
    description: string;
    locationText: string;
    incidentType: IncidentType;
    severityLevel: IncidentSeverity;
    latitude: number | null;
    longitude: number | null;
    reporterId: string;
    spamFlagged: boolean;
  }
): Promise<{ crisisEventId: string; isNew: boolean } | null> {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return null;
  }
  try {
    return await clusterReportIntoCrisisEvent(reportMeta);
  } catch (error) {
    console.error("Failed to cluster report into crisis event:", reportId, error);
    return null;
  }
}

export async function listIncidentReports(
  input: ListIncidentReportsInput,
  dependencies: ListIncidentReportsDependencies = defaultListDependencies
): Promise<IncidentReportListItem[]> {
  const page = Math.max(1, input.page);
  const limit = Math.max(1, input.limit);
  const skip = (page - 1) * limit;

  // P1-9: Push pagination, sort, and search to DB level
  const reports = await dependencies.listReports({
    viewerId: input.viewerId,
    scope: input.scope,
    severity: input.severity,
    search: input.search,
    sortBy: input.sortBy,
    order: input.order,
    skip,
    take: limit
  });

  // Severity sort still needs in-memory handling (enum, not numeric in DB)
  let processed = reports;
  if (input.sortBy === "severity") {
    processed = [...reports].sort((a, b) => {
      const cmp = severityOrderMap[a.severityLevel] - severityOrderMap[b.severityLevel];
      return input.order === "asc" ? cmp : -cmp;
    });
  }

  const reporterIds = Array.from(new Set(processed.map((r) => r.reporterId)));
  const reporters = await dependencies.listUsers(reporterIds);
  const reporterMap = buildReporterMap(reporters);

  return processed.map((report) => toListItem(report, input.viewerId, reporterMap));
}

export type IncidentReportDetail = {
  id: string;
  reporterId: string;
  reporterName: string;
  incidentTitle: string;
  classifiedIncidentTitle: string;
  incidentType: IncidentType;
  classifiedIncidentType: IncidentType;
  description: string;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  mediaFilenames: string[];
  credibilityScore: number;
  severityLevel: IncidentSeverity;
  status: IncidentStatus;
  spamFlagged: boolean;
  createdAt: string;
};

export async function getIncidentReportById(
  reportId: string,
  viewerId: string,
  viewerRole: string
): Promise<IncidentReportDetail> {
  const report = await prisma.incidentReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new SafeError("Report not found");
  }

  const isMine = report.reporterId === viewerId;
  const isAdmin = viewerRole === "ADMIN";

  // Unpublished reports are only visible to the reporter and admins
  // (includes UNDER_REVIEW, REJECTED, CLARIFICATION_REQUESTED)
  if (report.status !== "PUBLISHED" && !isMine && !isAdmin) {
    throw new SafeError("Report not found");
  }

  const reporter = await prisma.user.findUnique({
    where: { id: report.reporterId },
    select: { id: true, fullName: true }
  });

  return {
    id: report.id,
    reporterId: report.reporterId,
    reporterName: isMine ? "You" : reporter?.fullName ?? "Community Member",
    incidentTitle: report.incidentTitle,
    classifiedIncidentTitle: report.classifiedIncidentTitle,
    incidentType: report.incidentType,
    classifiedIncidentType: report.classifiedIncidentType,
    description: report.description,
    locationText: report.locationText,
    latitude: report.latitude,
    longitude: report.longitude,
    mediaFilenames: report.mediaFilenames,
    credibilityScore: report.credibilityScore,
    severityLevel: report.severityLevel,
    status: report.status,
    spamFlagged: report.spamFlagged,
    createdAt: report.createdAt.toISOString()
  };
}

export async function listUnderReviewIncidentReports(
  input: ListUnderReviewIncidentReportsInput,
  dependencies: ListIncidentReportsDependencies = defaultListDependencies
): Promise<IncidentReportListItem[]> {
  const page = Math.max(1, input.page);
  const limit = Math.max(1, input.limit);
  const skip = (page - 1) * limit;

  const reports = await dependencies.listReports({
    viewerId: "",
    scope: "under_review",
    severity: input.severity,
    search: input.search,
    sortBy: input.sortBy,
    order: input.order,
    skip,
    take: limit
  });

  let processed = reports;
  if (input.sortBy === "severity") {
    processed = [...reports].sort((a, b) => {
      const cmp = severityOrderMap[a.severityLevel] - severityOrderMap[b.severityLevel];
      return input.order === "asc" ? cmp : -cmp;
    });
  }

  const reporterIds = Array.from(new Set(processed.map((r) => r.reporterId)));
  const reporters = await dependencies.listUsers(reporterIds);
  const reporterMap = buildReporterMap(reporters);

  return processed.map((report) => toListItem(report, "", reporterMap));
}

// Valid report status transitions. Prevents nonsensical transitions like
// REJECTED → PUBLISHED (must go through UNDER_REVIEW for re-review) or
// MERGED → anything (terminal state).
const VALID_REPORT_TRANSITIONS: Record<string, Set<string>> = {
  UNDER_REVIEW: new Set(["PUBLISHED", "REJECTED", "CLARIFICATION_REQUESTED", "MERGED"]),
  CLARIFICATION_REQUESTED: new Set(["UNDER_REVIEW", "PUBLISHED", "REJECTED", "MERGED"]),
  PUBLISHED: new Set(["REJECTED", "UNDER_REVIEW", "MERGED"]),
  REJECTED: new Set(["UNDER_REVIEW"]), // Can be re-reviewed, but not directly published
  MERGED: new Set(), // Terminal
};

export async function updateIncidentReportStatusByAdmin(
  reportId: string,
  status: IncidentStatus
) {
  // Fetch current status to validate the transition
  const existing = await prisma.incidentReport.findUnique({
    where: { id: reportId },
    select: { status: true }
  });

  if (!existing) {
    throw new SafeError("Report not found");
  }

  if (existing.status !== status) {
    const allowed = VALID_REPORT_TRANSITIONS[existing.status];
    if (!allowed || !allowed.has(status)) {
      throw new SafeError(`Invalid status transition from ${existing.status} to ${status}`);
    }
  }

  const updated = await prisma.incidentReport.update({
    where: { id: reportId },
    data: {
      status,
      spamFlagged: status === "PUBLISHED" ? false : undefined,
      updatedAt: new Date()
    },
    select: {
      id: true,
      status: true,
      spamFlagged: true,
      incidentTitle: true,
      description: true,
      locationText: true,
      incidentType: true,
      classifiedIncidentType: true,
      classifiedIncidentTitle: true,
      severityLevel: true,
      latitude: true,
      longitude: true,
      reporterId: true
    }
  });

  // P0-08: When a report is published, cluster it into a crisis event
  // (previously, admin-published reports never entered clustering or notification)
  if (status === "PUBLISHED" && !updated.spamFlagged) {
    // Award community contribution points for verified incident report (+10 pts)
    try {
      const reporter = await prisma.user.findUnique({
        where: { id: updated.reporterId },
        select: { role: true }
      });
      if (reporter?.role === "VOLUNTEER") {
        await prisma.user.update({
          where: { id: updated.reporterId },
          data: { totalPoints: { increment: 10 } }
        });
        const { checkAndAwardBadges } = await import("./timesheetService.js");
        const { checkAndPromoteTrustTier } = await import("./trustTierService.js");
        await checkAndAwardBadges(updated.reporterId);
        await checkAndPromoteTrustTier(updated.reporterId);
      }
    } catch (err) {
      console.error("[report-publish] Failed to award community points:", err);
    }

    try {
      const clusterResult = await clusterReportIntoCrisisEvent({
        id: updated.id,
        incidentTitle: updated.incidentTitle,
        description: updated.description,
        locationText: updated.locationText,
        incidentType: updated.classifiedIncidentType,
        severityLevel: updated.severityLevel,
        latitude: updated.latitude,
        longitude: updated.longitude,
        reporterId: updated.reporterId,
        spamFlagged: false
      });

      // FR-03: Extract structured claims from the admin-published report
      if (clusterResult?.crisisEventId && clusterResult.crisisEventId !== "spam-skipped") {
        try {
          const extractedClaims = await extractClaimsFromText(
            reportId,
            updated.description,
            updated.reporterId
          );
          if (extractedClaims.length > 0) {
            await persistClaims(
              clusterResult.crisisEventId,
              reportId,
              extractedClaims,
              updated.reporterId,
              updated.description
            );
          }
        } catch (err) {
          console.error("Claim extraction failed for admin-published report", reportId, err);
        }
      }
    } catch (error) {
      console.error("Failed to cluster admin-published report:", reportId, error);
    }
  }

  // P1: When clarification is requested, notify the reporter
  if (status === "CLARIFICATION_REQUESTED") {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: updated.reporterId,
          title: "Clarification Requested",
          body: `Your report "${updated.incidentTitle}" needs additional details. Please review and update.`,
          type: "CRISIS_UPDATE",
          deliveryState: "QUEUED"
        }
      });
      const { enqueueJob } = await import("./outboxService.js");
      await enqueueJob({
        jobType: "NOTIFICATION_DISPATCH",
        payload: {
          notificationId: notification.id,
          userId: updated.reporterId,
          title: "Clarification Requested",
          body: `Your report "${updated.incidentTitle}" needs additional details.`,
          url: `/reports/${updated.id}`,
        },
        targetEntityId: notification.id,
        dedupeKey: `notif-${notification.id}`,
      });
    } catch (error) {
      console.error("Failed to send clarification notification:", error);
    }
  }

  return {
    id: updated.id,
    status: updated.status,
    spamFlagged: updated.spamFlagged
  };
}

export async function getMapIncidentReports(_viewerId: string) {
  return prisma.crisisEvent.findMany({
    where: {
      status: {
        notIn: ["RESOLVED", "CLOSED"]
      },
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      canonicalId: true,
      title: true,
      incidentType: true,
      severityLevel: true,
      locationText: true,
      sitRepText: true,
      latitude: true,
      longitude: true,
      createdAt: true
    },
    take: 500
  });
}

/**
 * AC-05.04: Returns crisis events in the same filtered format as the map,
 * so the accessible list view shows identical results to the map view.
 */
export async function listCrisisEventsForListView(filters?: {
  incidentType?: string;
  severity?: string;
  search?: string;
}) {
  const where: any = {
    status: { notIn: ["RESOLVED", "CLOSED"] },
  };

  if (filters?.incidentType) {
    where.incidentType = filters.incidentType;
  }
  if (filters?.severity) {
    where.severityLevel = filters.severity;
  }
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { locationText: { contains: filters.search, mode: "insensitive" } },
      { sitRepText: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.crisisEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      canonicalId: true,
      title: true,
      incidentType: true,
      severityLevel: true,
      status: true,
      locationText: true,
      sitRepText: true,
      latitude: true,
      longitude: true,
      reportCount: true,
      reporterCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * AC-04.04: Unlink a report from its crisis event.
 *
 * - Deletes the CrisisEventReport junction record
 * - Sets the report status back to UNDER_REVIEW
 * - Logs an audit event (action: REPORT_UNLINKED_FROM_CRISIS)
 * - Returns the updated report
 */
export async function unlinkReportFromCrisisEvent(
  reportId: string,
  actorId: string
) {
  // Find the existing junction record
  const link = await prisma.crisisEventReport.findFirst({
    where: { incidentReportId: reportId }
  });

  if (!link) {
    throw new SafeError("Report is not linked to any crisis event");
  }

  const crisisEventId = link.crisisEventId;

  // Delete the junction record and revert the report status in a transaction
  const [, updated] = await prisma.$transaction([
    prisma.crisisEventReport.delete({
      where: { id: link.id }
    }),
    prisma.incidentReport.update({
      where: { id: reportId },
      data: {
        status: "UNDER_REVIEW",
        updatedAt: new Date()
      },
      select: {
        id: true,
        status: true,
        incidentTitle: true,
        description: true,
        locationText: true,
        incidentType: true,
        severityLevel: true,
        spamFlagged: true,
        reporterId: true
      }
    })
  ]);

  // Log the audit event
  const { logAuditEvent } = await import("./auditService.js");
  await logAuditEvent({
    actorId,
    actorRole: "ADMIN",
    action: "REPORT_UNLINKED_FROM_CRISIS",
    targetType: "IncidentReport",
    targetId: reportId,
    beforeJson: JSON.stringify({ crisisEventId }),
    afterJson: JSON.stringify({ status: "UNDER_REVIEW" })
  });

  return updated;
}

/**
 * Link an incident report to an existing crisis event (manual merge).
 * Creates the CrisisEventReport junction record and sets the report status to MERGED.
 */
export async function linkReportToCrisisEvent(
  reportId: string,
  crisisEventId: string,
  actorId: string
) {
  // Verify the report exists
  const report = await prisma.incidentReport.findUnique({
    where: { id: reportId },
    select: { id: true, status: true }
  });

  if (!report) {
    throw new SafeError("Report not found");
  }

  // Verify the crisis event exists
  const crisis = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
    select: { id: true, title: true }
  });

  if (!crisis) {
    throw new SafeError("Crisis event not found");
  }

  // Check if the report is already linked to a crisis event
  const existingLink = await prisma.crisisEventReport.findFirst({
    where: { incidentReportId: reportId }
  });

  if (existingLink) {
    if (existingLink.crisisEventId === crisisEventId) {
      throw new SafeError("Report is already linked to this crisis event");
    }
    // Unlink from the previous crisis event first
    await prisma.crisisEventReport.delete({
      where: { id: existingLink.id }
    });
  }

  // Create the junction record and update the report status in a transaction
  const [, updated] = await prisma.$transaction([
    prisma.crisisEventReport.create({
      data: {
        crisisEventId,
        incidentReportId: reportId
      }
    }),
    prisma.incidentReport.update({
      where: { id: reportId },
      data: {
        status: "MERGED",
        updatedAt: new Date()
      },
      select: {
        id: true,
        status: true,
        incidentTitle: true,
        description: true,
        locationText: true,
        incidentType: true,
        classifiedIncidentType: true,
        classifiedIncidentTitle: true,
        severityLevel: true,
        spamFlagged: true,
        reporterId: true
      }
    })
  ]);

  // Log the audit event
  const { logAuditEvent } = await import("./auditService.js");
  await logAuditEvent({
    actorId,
    actorRole: "ADMIN",
    action: "REPORT_LINKED_TO_CRISIS",
    targetType: "IncidentReport",
    targetId: reportId,
    afterJson: JSON.stringify({ crisisEventId, crisisTitle: crisis.title, status: "MERGED" })
  });

  return updated;
}
