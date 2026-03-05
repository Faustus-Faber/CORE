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

type UploadedFileMeta = {
  originalname: string;
  mimetype: string;
  size: number;
};

const severityRanking: Record<IncidentSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const allIncidentTypes: IncidentType[] = [
  "FLOOD",
  "FIRE",
  "EARTHQUAKE",
  "BUILDING_COLLAPSE",
  "ROAD_ACCIDENT",
  "VIOLENCE",
  "MEDICAL_EMERGENCY",
  "OTHER"
];

const allSeverities: IncidentSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const allStatuses: IncidentStatus[] = ["PUBLISHED", "UNDER_REVIEW"];
const objectIdHexPattern = /^[a-fA-F0-9]{24}$/;

export type CreateIncidentReportInput = {
  reporterId: string;
  incidentTitle: string;
  description: string;
  incidentType: IncidentType | string;
  locationText: string;
  mediaFiles: UploadedFileMeta[];
  voiceFile?: (VoiceInputFile & { size: number }) | undefined;
};

type PersistedReportSummary = Pick<IncidentReport, "id">;

export type CreateIncidentReportDependencies = {
  submitVoiceReport: (file: VoiceInputFile) => Promise<VoiceReportResult>;
  classifyIncidentText: (text: string) => Promise<TextAnalysisResult>;
  createReportRecord: (data: Omit<IncidentReport, "id">) => Promise<PersistedReportSummary>;
};

type ReportListScope = "community" | "mine" | "under_review";
type ReportSortBy = "createdAt" | "severity" | "credibility";
type ReportSortOrder = "asc" | "desc";
type SeverityFilter = IncidentSeverity | "ALL";

export type ListIncidentReportsInput = {
  viewerId: string;
  scope: ReportListScope;
  search: string;
  severity: SeverityFilter;
  sortBy: ReportSortBy;
  order: ReportSortOrder;
};

export type ListUnderReviewIncidentReportsInput = {
  search: string;
  severity: SeverityFilter;
  sortBy: ReportSortBy;
  order: ReportSortOrder;
};

type ReportRecordForList = Pick<
  IncidentReport,
  | "id"
  | "reporterId"
  | "incidentTitle"
  | "classifiedIncidentTitle"
  | "description"
  | "locationText"
  | "credibilityScore"
  | "severityLevel"
  | "status"
  | "spamFlagged"
  | "incidentType"
  | "classifiedIncidentType"
  | "createdAt"
>;

type ReporterRecord = {
  id: string;
  fullName: string;
};

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
  listUsers: (userIds: string[]) => Promise<ReporterRecord[]>;
};

const defaultDependencies: CreateIncidentReportDependencies = {
  submitVoiceReport,
  classifyIncidentText,
  createReportRecord: async (data) => {
    return prisma.incidentReport.create({
      data,
      select: {
        id: true
      }
    });
  }
};

const defaultListDependencies: ListIncidentReportsDependencies = {
  listReports: async ({ viewerId, scope, severity }) => {
    const where: Prisma.IncidentReportWhereInput = {
      AND: [
        { incidentTitle: { contains: "" } },
        { description: { contains: "" } },
        { locationText: { contains: "" } },
        { classifiedIncidentTitle: { contains: "" } },
        { incidentType: { in: allIncidentTypes } },
        { classifiedIncidentType: { in: allIncidentTypes } },
        { severityLevel: { in: allSeverities } },
        { status: { in: allStatuses } },
        { credibilityScore: { gte: 0 } },
        { OR: [{ spamFlagged: true }, { spamFlagged: false }] },
        { createdAt: { gte: new Date("1970-01-01T00:00:00.000Z") } }
      ]
    };

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

    return prisma.incidentReport.findMany({
      where,
      select: {
        id: true,
        incidentTitle: true,
        classifiedIncidentTitle: true,
        description: true,
        locationText: true,
        credibilityScore: true,
        severityLevel: true,
        status: true,
        spamFlagged: true,
        incidentType: true,
        classifiedIncidentType: true,
        createdAt: true
      }
    }).then((reports) =>
      reports.map((report) => ({
        ...report,
        reporterId: scope === "mine" ? viewerId : ""
      }))
    );
  },
  listUsers: async (userIds) => {
    const validUserIds = userIds.filter((id) => objectIdHexPattern.test(id));
    if (validUserIds.length === 0) {
      return [];
    }

    return prisma.user.findMany({
      where: {
        id: {
          in: validUserIds
        }
      },
      select: {
        id: true,
        fullName: true
      }
    });
  }
};

const incidentTypeMap: Record<string, IncidentType> = {
  FLOOD: "FLOOD",
  FIRE: "FIRE",
  EARTHQUAKE: "EARTHQUAKE",
  BUILDING_COLLAPSE: "BUILDING_COLLAPSE",
  BUILDINGCOLLAPSE: "BUILDING_COLLAPSE",
  ROAD_ACCIDENT: "ROAD_ACCIDENT",
  ROADACCIDENT: "ROAD_ACCIDENT",
  VIOLENCE: "VIOLENCE",
  MEDICAL_EMERGENCY: "MEDICAL_EMERGENCY",
  MEDICALEMERGENCY: "MEDICAL_EMERGENCY",
  OTHER: "OTHER"
};

const severityMap: Record<string, IncidentSeverity> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW"
};

function normalizeKey(value: string) {
  return value.replace(/[\s-]+/g, "_").replace(/[^A-Za-z_]/g, "").toUpperCase();
}

function toIncidentType(value: string): IncidentType {
  const normalized = normalizeKey(value);
  return incidentTypeMap[normalized] ?? "OTHER";
}

function toIncidentSeverity(value: string): IncidentSeverity {
  const normalized = normalizeKey(value);
  return severityMap[normalized] ?? "LOW";
}

function toIncidentStatus(spamFlagged: boolean): IncidentStatus {
  return spamFlagged ? "UNDER_REVIEW" : "PUBLISHED";
}

function clampCredibilityScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function matchesSearch(report: ReportRecordForList, search: string) {
  if (!search.trim()) {
    return true;
  }

  const needle = search.trim().toLowerCase();
  const haystack = [
    report.incidentTitle,
    report.classifiedIncidentTitle,
    report.locationText,
    report.description
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
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

  return order === "asc" ? comparison : comparison * -1;
}

export async function createIncidentReport(
  input: CreateIncidentReportInput,
  dependencies: CreateIncidentReportDependencies = defaultDependencies
) {
  let description = input.description.trim();
  let voiceMetadata: VoiceReportResult | undefined;

  if (input.voiceFile) {
    voiceMetadata = await dependencies.submitVoiceReport(input.voiceFile);
    if (voiceMetadata.translated_description?.trim()) {
      description = voiceMetadata.translated_description.trim();
    }
  }

  if (!description) {
    throw new Error("Description or voice note is required");
  }

  const analysis = await dependencies.classifyIncidentText(description);
  const credibilityScore = clampCredibilityScore(analysis.credibility_score);
  const spamFlagged = analysis.spam_flagged || credibilityScore < 30;
  const status = toIncidentStatus(spamFlagged);
  const severityLevel = toIncidentSeverity(analysis.severity_level);
  const userSelectedIncidentType = toIncidentType(String(input.incidentType));
  const classifiedIncidentType = toIncidentType(analysis.incident_type);
  const classifiedIncidentTitle =
    analysis.incident_title.trim() || input.incidentTitle.trim();

  const created = await dependencies.createReportRecord({
    reporterId: input.reporterId,
    incidentTitle: input.incidentTitle.trim(),
    description,
    incidentType: userSelectedIncidentType,
    locationText: input.locationText.trim(),
    mediaFilenames: input.mediaFiles.map((file) => file.originalname),
    sourceAudioFilename:
      voiceMetadata?.filename ?? input.voiceFile?.originalname ?? null,
    detectedLanguage: voiceMetadata?.detected_language ?? null,
    languageProbability: voiceMetadata?.language_probability ?? null,
    translatedDescription: voiceMetadata?.translated_description ?? null,
    credibilityScore,
    severityLevel,
    classifiedIncidentType,
    classifiedIncidentTitle,
    spamFlagged,
    status,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return {
    id: created.id,
    incidentTitle: input.incidentTitle.trim(),
    classifiedIncidentTitle,
    severityLevel,
    credibilityScore,
    classifiedIncidentType,
    spamFlagged,
    status,
    translatedDescription: voiceMetadata?.translated_description ?? null
  };
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

  const scopedReports = reports.filter((report) =>
    input.scope === "mine"
      ? report.reporterId === input.viewerId
      : report.status === "PUBLISHED" && !report.spamFlagged
  );

  const severityFilteredReports =
    input.severity === "ALL"
      ? scopedReports
      : scopedReports.filter((report) => report.severityLevel === input.severity);

  const filteredReports = severityFilteredReports
    .filter((report) => matchesSearch(report, input.search))
    .sort((left, right) =>
      compareReports(left, right, input.sortBy, input.order)
    );

  const reporterIds = Array.from(
    new Set(filteredReports.map((report) => report.reporterId))
  );
  const reporters = await dependencies.listUsers(reporterIds);
  const reporterMap = new Map(reporters.map((reporter) => [reporter.id, reporter.fullName]));

  return filteredReports.map((report) => {
    const isMine = report.reporterId === input.viewerId;
    const reporterName = isMine
      ? "You"
      : reporterMap.get(report.reporterId) ?? "Community Member";

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
      credibilityScore: report.credibilityScore,
      severityLevel: report.severityLevel,
      status: report.status,
      spamFlagged: report.spamFlagged,
      createdAt: report.createdAt.toISOString()
    };
  });
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

  const scopedReports = reports.filter((report) => report.status === "UNDER_REVIEW");

  const filteredReports = scopedReports
    .filter((report) => matchesSearch(report, input.search))
    .sort((left, right) =>
      compareReports(left, right, input.sortBy, input.order)
    );

  const reporterIds = Array.from(
    new Set(filteredReports.map((report) => report.reporterId))
  );
  const reporters = await dependencies.listUsers(reporterIds);
  const reporterMap = new Map(
    reporters.map((reporter) => [reporter.id, reporter.fullName])
  );

  return filteredReports.map((report) => {
    return {
      id: report.id,
      reporterId: report.reporterId,
      reporterName: reporterMap.get(report.reporterId) ?? "Community Member",
      isMine: false,
      incidentTitle: report.incidentTitle,
      classifiedIncidentTitle: report.classifiedIncidentTitle,
      incidentType: report.incidentType,
      classifiedIncidentType: report.classifiedIncidentType,
      description: report.description,
      locationText: report.locationText,
      credibilityScore: report.credibilityScore,
      severityLevel: report.severityLevel,
      status: report.status,
      spamFlagged: report.spamFlagged,
      createdAt: report.createdAt.toISOString()
    };
  });
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
    select: {
      id: true,
      status: true,
      spamFlagged: true
    }
  });
}
