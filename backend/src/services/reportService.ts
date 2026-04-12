import type {
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Prisma
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
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
    where.status = "UNDER_REVIEW";
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

const defaultListDependencies: ListIncidentReportsDependencies = {
  listReports: ({ viewerId, scope, severity }) =>
    prisma.incidentReport.findMany({
      where: buildListWhere(scope, viewerId, severity),
      select: REPORT_LIST_SELECT
    }),
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

  if (input.voiceFile) {
    voiceMetadata = await dependencies.submitVoiceReport(input.voiceFile);
    const translated = voiceMetadata.translated_description?.trim();
    if (translated) {
      description = translated;
    }
  }

  if (!description) {
    throw new Error("Description or voice note is required");
  }

  const analysis = await dependencies.classifyIncidentText(description, input.latitude, input.longitude);
  const credibilityScore = clampCredibilityScore(analysis.credibility_score);
  const spamFlagged = analysis.spam_flagged || credibilityScore < 30;
  const status: IncidentStatus = spamFlagged ? "UNDER_REVIEW" : "PUBLISHED";
  const severityLevel = toIncidentSeverity(analysis.severity_level);
  const userSelectedIncidentType = toIncidentType(String(input.incidentType));
  const classifiedIncidentType = toIncidentType(analysis.incident_type);
  const classifiedIncidentTitle = analysis.incident_title.trim() || trimmedTitle;

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
    credibilityScore,
    severityLevel,
    classifiedIncidentType,
    classifiedIncidentTitle,
    spamFlagged,
    status,
    createdAt: now,
    updatedAt: now
  });

  await clusterReportAfterCreation(created.id, {
    id: created.id,
    incidentTitle: trimmedTitle,
    description,
    locationText: trimmedLocation,
    incidentType: classifiedIncidentType,
    severityLevel,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    reporterId: input.reporterId
  });

  return {
    id: created.id,
    incidentTitle: trimmedTitle,
    classifiedIncidentTitle,
    severityLevel,
    credibilityScore,
    classifiedIncidentType,
    spamFlagged,
    status,
    translatedDescription: voiceMetadata?.translated_description ?? null
  };
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
  }
) {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return;
  }
  try {
    await clusterReportIntoCrisisEvent(reportMeta);
  } catch (error) {
    console.error("Failed to cluster report into crisis event:", reportId, error);
  }
}

export async function listIncidentReports(
  input: ListIncidentReportsInput,
  dependencies: ListIncidentReportsDependencies = defaultListDependencies
): Promise<IncidentReportListItem[]> {
  const reports = await dependencies.listReports({
    viewerId: input.viewerId,
    scope: input.scope,
    severity: input.severity
  });
  return paginateAndHydrate(reports, input, input.viewerId, dependencies);
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
  viewerId: string
): Promise<IncidentReportDetail> {
  const report = await prisma.incidentReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error("Report not found");
  }

  const reporter = await prisma.user.findUnique({
    where: { id: report.reporterId },
    select: { id: true, fullName: true }
  });

  const isMine = report.reporterId === viewerId;

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
  const reports = await dependencies.listReports({
    viewerId: "",
    scope: "under_review",
    severity: input.severity
  });
  return paginateAndHydrate(reports, input, "", dependencies);
}

export async function updateIncidentReportStatusByAdmin(
  reportId: string,
  status: IncidentStatus
) {
  return prisma.incidentReport.update({
    where: { id: reportId },
    data: {
      status,
      spamFlagged: status === "PUBLISHED" ? false : undefined,
      updatedAt: new Date()
    },
    select: { id: true, status: true, spamFlagged: true }
  });
}

export async function getMapIncidentReports(_viewerId: string) {
  return prisma.incidentReport.findMany({
    where: {
      status: "PUBLISHED",
      spamFlagged: false,
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      incidentTitle: true,
      classifiedIncidentTitle: true,
      incidentType: true,
      classifiedIncidentType: true,
      severityLevel: true,
      description: true,
      latitude: true,
      longitude: true,
      createdAt: true
    }
  });
}
