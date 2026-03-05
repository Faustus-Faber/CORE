export type Role = "USER" | "VOLUNTEER" | "ADMIN";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  role: Role;
  avatarUrl?: string | null;
  skills: string[];
  availability?: string | null;
  certifications?: string | null;
  dispatchOptIn?: boolean;
};

export type IncidentType =
  | "FLOOD"
  | "FIRE"
  | "EARTHQUAKE"
  | "BUILDING_COLLAPSE"
  | "ROAD_ACCIDENT"
  | "VIOLENCE"
  | "MEDICAL_EMERGENCY"
  | "OTHER";

export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatus = "PUBLISHED" | "UNDER_REVIEW";
export type ReportSortBy = "createdAt" | "severity" | "credibility";
export type SortOrder = "asc" | "desc";

export type ReportListQuery = {
  search?: string;
  severity?: IncidentSeverity | "ALL";
  sortBy?: ReportSortBy;
  order?: SortOrder;
  page?: number;
  limit?: number;
};

export type EmergencyReportSubmissionInput = {
  incidentTitle: string;
  description: string;
  incidentType: IncidentType;
  locationText: string;
  mediaFiles: File[];
  uploadedAudioFile?: File | null;
  recordedAudioBlob?: Blob | null;
  recordedAudioFilename?: string;
};

export type EmergencyReportSummary = {
  id: string;
  incidentTitle: string;
  classifiedIncidentTitle: string;
  severityLevel: IncidentSeverity;
  credibilityScore: number;
  classifiedIncidentType: IncidentType;
  spamFlagged: boolean;
  status: IncidentStatus;
  translatedDescription: string | null;
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
  mediaFilenames: string[];
  credibilityScore: number;
  severityLevel: IncidentSeverity;
  status: IncidentStatus;
  spamFlagged: boolean;
  createdAt: string;
};
