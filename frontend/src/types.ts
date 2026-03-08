export type Role = "USER" | "VOLUNTEER" | "ADMIN";

export type InteractionContext =
  | "RESCUE_OPERATION"
  | "MEDICAL_AID"
  | "SUPPLY_DISTRIBUTION"
  | "SHELTER_MANAGEMENT"
  | "OTHER";

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
  isFlagged?: boolean;
  volunteerFlagReasons?: string[];
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

export type Review = {
  id: string;
  reviewerId: string;
  volunteerId: string;
  rating: number;
  text: string;
  interactionContext: InteractionContext;
  interactionDate: string;
  wouldWorkAgain: boolean;
  crisisEventId?: string | null;
  isFlagged: boolean;
  flagReasons: string[];
  createdAt: string;
  reviewer?: { fullName: string; avatarUrl?: string | null; email?: string };
  volunteer?: { id: string; fullName: string; email: string };
};

export type FlaggedVolunteer = {
  id: string;
  fullName: string;
  email: string;
  location: string;
  role: "VOLUNTEER";
  isFlagged: true;
  volunteerFlagReasons: string[];
  createdAt: string;
  reviewsReceived: {
    rating: number;
    wouldWorkAgain: boolean;
    isFlagged: boolean;
    createdAt: string;
  }[];
};

// Feature 4: Secure Documentation Types
export interface FolderFile {
  id: string;
  folderId: string;
  uploaderId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  sizeBytes: number;
  gpsLat?: number | null;
  gpsLng?: number | null;
  createdAt: string;
}

export interface FolderNote {
  id: string;
  folderId: string;
  authorId: string;
  content: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  createdAt: string;
}

export interface SecureFolder {
  id: string;
  name: string;
  description?: string | null;
  crisisId?: string | null;
  ownerId: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
    notes: number;
  };
  files?: FolderFile[];
  notes?: FolderNote[];
}
