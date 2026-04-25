export type Role = "USER" | "VOLUNTEER" | "ADMIN";

export type InteractionContext =
  | "RESCUE_OPERATION"
  | "MEDICAL_AID"
  | "SUPPLY_DISTRIBUTION"
  | "SHELTER_MANAGEMENT"
  | "OTHER";

export type TaskCategory =
  | "RESCUE"
  | "MEDICAL_AID"
  | "SUPPLY_DISTRIBUTION"
  | "SHELTER_SETUP"
  | "CLEANUP"
  | "COUNSELING"
  | "TRANSPORTATION"
  | "OTHER";

export type TaskStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type CrisisResponderStatus =
  | "RESPONDING"
  | "EN_ROUTE"
  | "ON_SITE"
  | "COMPLETED"
  | "UNAVAILABLE";

export type BadgeType =
  | "FIRST_RESPONDER"
  | "RISING_STAR"
  | "CRISIS_HERO"
  | "COMMUNITY_GUARDIAN"
  | "ELITE_VOLUNTEER"
  | "CENTURY"
  | "TEAM_PLAYER";

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
  latitude?: number | null;
  longitude?: number | null;
  avgRating?: number;
  reviewCount?: number;
  distance?: number;
  totalPoints?: number;
  totalVerifiedHours?: number;
  badges?: Badge[];
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
export type CrisisEventStatus =
  | "REPORTED"
  | "VERIFIED"
  | "UNDER_INVESTIGATION"
  | "RESPONSE_IN_PROGRESS"
  | "CONTAINED"
  | "RESOLVED"
  | "CLOSED";
export type ReportSortBy = "createdAt" | "severity" | "credibility";
export type SortOrder = "asc" | "desc";
export type DashboardSortBy = "mostRecent" | "highestSeverity" | "mostReports";
export type DashboardTimeRange = 1 | 6 | 24 | 168 | 0;

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
  latitude?: number | null;
  longitude?: number | null;
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
  crisisEventId: string;
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

// ── Feature 3.7: Gamification Types ──────────────────────────────────────────

export type Badge = {
  id: string;
  userId: string;
  badgeType: BadgeType;
  awardedAt: string;
};

export type DispatchAlertLog = {
  id: string;
  userId: string;
  crisisEventId?: string | null;
  crisisEvent?: { title: string; severityLevel: string };
  emailMasked: string;
  status: "QUEUED" | "SENT" | "FAILED";
  providerMessageId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

export type CrisisResponder = {
  id: string;
  volunteerId: string;
  volunteerName: string;
  avatarUrl: string | null;
  skills: string[];
  location: string;
  status: CrisisResponderStatus;
  optedInAt: string;
  lastStatusAt: string;
  updatedAt: string;
};

export type EligibleReviewCrisis = {
  id: string;
  title: string;
  incidentType: string;
  severityLevel: string;
  status: string;
  locationText: string;
  responderStatus: CrisisResponderStatus;
  lastStatusAt: string;
};

export type VolunteerTask = {
  id: string;
  volunteerId: string;
  volunteer?: { id: string; fullName: string; email: string; avatarUrl?: string | null };
  title: string;
  description: string;
  category: TaskCategory;
  hoursSpent: number;
  dateOfTask: string;
  crisisEventId?: string | null;
  status: TaskStatus;
  pointsAwarded: number;
  evidenceUrls: string[];
  verifiedById?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  totalPoints: number;
  totalVerifiedHours: number;
  badgeCount: number;
  badges: Pick<Badge, "badgeType" | "awardedAt">[];
  avgRating: number | null;
  reviewCount: number;
};

export type TimesheetSummary = {
  totalPoints: number;
  totalVerifiedHours: number;
  badges: Badge[];
};

// Feature 4: Secure Documentation Types
export interface FolderFile {
  id: string;
  folderId: string;
  uploaderId: string;
  fileName: string;
  description?: string | null;
  fileUrl: string;
  fileType: string;
  sizeBytes: number;
  gpsLat?: number | null;
  gpsLng?: number | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
}

export interface FolderNote {
  id: string;
  folderId: string;
  authorId: string;
  content: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
}

export interface SecureFolder {
  id: string;
  name: string;
  description?: string | null;
  crisisId?: string | null;
  ownerId: string;
  owner?: {
    id: string;
    fullName: string;
    email?: string;
  };
  isDeleted: boolean;
  isPinned: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
    notes: number;
  };
  files?: FolderFile[];
  notes?: FolderNote[];
  shareLinks?: {
    token: string;
    expiresAt?: string | null;
  }[];
}

export interface CrisisEventCard {
  id: string;
  title: string;
  classifiedIncidentTitle: string;
  incidentType: IncidentType;
  severityLevel: IncidentSeverity;
  status: CrisisEventStatus;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  reportCount: number;
  reporterCount: number;
  credibilityScore: number;
  createdAt: string;
  mediaFilenames: string[];
  descriptionExcerpt: string;
}

export interface SitRepResponse {
  blueprint: SitRepBlueprint;
}

export type ThreatLevel = "GREEN" | "AMBER" | "RED" | "CRITICAL";
export type MetricColor = "critical" | "high" | "medium" | "low" | "neutral";
export type PulseIntensity = "critical" | "high" | "medium" | "low";

export interface SitRepMetric {
  label: string;
  value: number;
  trend?: string;
  color: MetricColor;
}

export interface SitRepPulsePoint {
  lat: number;
  lng: number;
  intensity: PulseIntensity;
  label: string;
}

export interface SitRepTimelineEvent {
  time: string;
  event: string;
  severity: string;
}

export interface SitRepWarning {
  zone: string;
  reason: string;
  until: string;
}

export interface SitRepResource {
  name: string;
  qty: string;
  location: string;
  eta: string;
}

export interface SitRepBlueprint {
  version: string;
  generatedAt: string;
  threatLevel: ThreatLevel;
  metrics: SitRepMetric[];
  pulseMap: SitRepPulsePoint[];
  timeline: SitRepTimelineEvent[];
  warnings: SitRepWarning[];
  resources: SitRepResource[];
  advisories: string[];
}

export interface ContributingReport {
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
  status: string;
  spamFlagged: boolean;
  createdAt: string;
}

export interface ResourceSummary {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  address: string;
  distanceKm?: number;
}

export interface IncidentDetailResponse {
  crisisEvent: {
    id: string;
    title: string;
    incidentType: IncidentType;
    severityLevel: IncidentSeverity;
    locationText: string;
    latitude: number | null;
    longitude: number | null;
    status: CrisisEventStatus;
    sitRepText: string | null;
    reportCount: number;
    reporterCount: number;
    createdAt: string;
    updatedAt: string;
  };
  commandCenter: CrisisCommandCenter;
  contributingReports: ContributingReport[];
  nearbyResources: ResourceSummary[];
}

export type DashboardFeedFilters = {
  incidentType: IncidentType | "ALL";
  severity: IncidentSeverity | "ALL";
  timeRange: DashboardTimeRange;
  sortBy: DashboardSortBy;
  sortOrder: SortOrder;
};

export type ReportDetailResponse = {
  report: {
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
};

export type CrisisEventStatusExpanded = CrisisEventStatus;

export type CrisisUpdateType =
  | "STATUS_CHANGE"
  | "FIELD_OBSERVATION"
  | "ACCESS_UPDATE"
  | "IMPACT_UPDATE"
  | "RESOURCE_NEED"
  | "CLOSURE_NOTE"
  | "ADMIN_CORRECTION"
  | "RESPONDER_STATUS";

export type CrisisUpdateVerificationStatus =
  | "RESPONDER_CONFIRMED"
  | "ADMIN_CONFIRMED"
  | "SYSTEM_LOGGED";

export type CrisisAccessStatus =
  | "OPEN"
  | "LIMITED"
  | "BLOCKED"
  | "UNKNOWN";

export type ClosureChecklist = {
  areaSafe: boolean;
  peopleAccounted: boolean;
  urgentNeedsStabilized: boolean;
};

export type CrisisCommandCenter = {
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  latestNote: string | null;
  latestUpdateType: CrisisUpdateType | null;
  verificationStatus: CrisisUpdateVerificationStatus | null;
  accessStatus: CrisisAccessStatus | null;
  affectedArea: string | null;
  casualtyCount: number | null;
  displacedCount: number | null;
  damageNotes: string | null;
  resourceNeeds: string[];
  closureChecklist: ClosureChecklist | null;
  activeResponderCount: number;
  responderCounts: Record<Exclude<CrisisResponderStatus, "UNAVAILABLE">, number>;
};

export type CrisisUpdateEntry = {
  id: string;
  crisisEventId: string;
  updaterId: string;
  updaterName: string;
  previousStatus: string;
  newStatus: string;
  updateType: CrisisUpdateType;
  verificationStatus: CrisisUpdateVerificationStatus;
  updateNote: string;
  newSeverity: IncidentSeverity | null;
  affectedArea: string | null;
  accessStatus: CrisisAccessStatus | null;
  casualtyCount: number | null;
  displacedCount: number | null;
  damageNotes: string | null;
  resourceNeeds: string[];
  closureChecklist: ClosureChecklist | null;
  isFlagged: boolean;
  reviewState: "ACTIVE" | "PENDING_REVIEW" | "DISMISSED";
  createdAt: string;
};

export type CrisisUpdateResponse = {
  entry: CrisisUpdateEntry;
  applied: boolean;
};

export type CrisisUpdateInput = {
  updateType: Exclude<CrisisUpdateType, "RESPONDER_STATUS">;
  status: CrisisEventStatusExpanded;
  updateNote: string;
  newSeverity?: IncidentSeverity;
  affectedArea?: string;
  accessStatus?: CrisisAccessStatus;
  casualtyCount?: number;
  displacedCount?: number;
  damageNotes?: string;
  resourceNeeds?: string[];
  closureChecklist?: ClosureChecklist;
};

export type NotificationPreferences = {
  incidentTypes: IncidentType[];
  radiusKm: number;
  isActive: boolean;
};

export type NotificationEntry = {
  id: string;
  title: string;
  body: string;
  survivalInstruction: string | null;
  isRead: boolean;
  crisisEventId: string | null;
  createdAt: string;
};

export type NotificationInboxResponse = {
  notifications: NotificationEntry[];
  unreadCount: number;
};
