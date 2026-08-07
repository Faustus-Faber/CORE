import type {
  AuthUser,
  CrisisResponder,
  CrisisResponderStatus,
  CrisisUpdateEntry,
  CrisisUpdateInput,
  DispatchAlertLog,
  EligibleReviewCrisis,
  CrisisEventCard,
  DashboardFeedFilters,
  EmergencyReportSubmissionInput,
  EmergencyReportSummary,
  FlaggedVolunteer,
  IncidentDetailResponse,
  IncidentReportListItem,
  ReportDetailResponse,
  LeaderboardEntry,
  TimesheetSummary,
  TrustTierInfo,
  Vouch,
  VolunteerTask,
  CrisisMessage,
  CrisisMessageListResponse,
  TrustTierVolunteer,
  Role,
  SitRepResponse,
  Review
} from "../types";
import { buildEmergencyReportFormData } from "./reportPayload";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export type ReportListQuery = {
  search?: string;
  severity?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
};

// ── HTTP client ──────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestInit = {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: FormData | string;
};

type ValidationError = {
  path?: string;
  message?: string;
};

type ErrorResponse = {
  message?: string;
  issues?: ValidationError[];
};

export async function request<T>(endpoint: string, options: { method?: HttpMethod; body?: unknown } = {}): Promise<T> {
  return httpClient<T>(endpoint, options.method ?? "GET", options.body);
}

async function httpClient<T>(endpoint: string, method: HttpMethod = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };

  // Add CSRF header for state-changing requests (double-submit cookie pattern).
  // The backend sets a non-httpOnly "csrf_token" cookie; we read it and send
  // it back as the x-csrf-token header for the server to compare.
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    const csrfToken = csrfMatch?.[1];
    if (csrfToken) headers["x-csrf-token"] = csrfToken;
  }

  const init: RequestInit = {
    method,
    headers,
    body: serializeBody(body, isFormData)
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    credentials: "include",
    signal
  });

  // 401: session expired — notify the app to redirect to login
  if (response.status === 401 && !endpoint.startsWith("/auth/")) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  const data = (await response.json().catch(() => ({}))) as ErrorResponse;

  if (!response.ok) {
    throw new Error(formatError(data));
  }

  return data as T;
}

function serializeBody(body: unknown | undefined, isFormData: boolean): FormData | string | undefined {
  if (!body) return undefined;
  return isFormData ? (body as FormData) : JSON.stringify(body);
}

function formatError(payload: ErrorResponse): string {
  if (Array.isArray(payload.issues) && payload.issues.length > 0) {
    return payload.issues
      .map((issue) =>
        issue.path ? `${issue.path}: ${issue.message ?? "Invalid value"}` : issue.message
      )
      .filter(Boolean)
      .join(" | ");
  }
  return payload.message ?? "Request failed";
}

function buildQueryString(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type RegisterPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  location: string;
  role: Exclude<Role, "ADMIN">;
  skills?: string[];
  availability?: string;
  certifications?: string;
};

export type LoginPayload = {
  identifier: string;
  password: string;
  rememberMe?: boolean;
};

type AuthResponse = { message: string; user: AuthUser };
type CurrentUserResponse = { user: AuthUser };
type MessageResponse = { message: string };

export async function registerUser(payload: RegisterPayload) {
  return httpClient<AuthResponse>("/auth/register", "POST", payload);
}

export async function loginUser(payload: LoginPayload) {
  return httpClient<AuthResponse>("/auth/login", "POST", payload);
}

export async function getCurrentUser() {
  return httpClient<CurrentUserResponse>("/auth/me");
}

export async function logoutUser() {
  return httpClient<MessageResponse>("/auth/logout", "POST");
}

export async function forgotPassword(email: string) {
  return httpClient<MessageResponse>("/auth/forgot-password", "POST", { email });
}

export async function resetPassword(token: string, password: string, confirmPassword: string) {
  return httpClient<MessageResponse>("/auth/reset-password", "POST", { token, password, confirmPassword });
}

// ── Profile ──────────────────────────────────────────────────────────────────

type ProfileResponse = { message: string; profile: AuthUser };

export async function updateProfile(payload: Partial<AuthUser>) {
  return httpClient<ProfileResponse>("/profile", "PATCH", payload);
}

export async function toggleDispatchOptInApi(dispatchOptIn: boolean) {
  return httpClient<{ dispatchOptIn: boolean }>("/profile/dispatch-opt-in", "PATCH", { dispatchOptIn });
}

export async function getMyDispatchLogsApi() {
  return httpClient<{ logs: DispatchAlertLog[] }>("/profile/dispatch-logs");
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}) {
  return httpClient<MessageResponse>("/profile/change-password", "POST", payload);
}

// ── Admin ────────────────────────────────────────────────────────────────────

type UserSummary = Pick<AuthUser, "id" | "fullName" | "email" | "phone" | "location" | "role"> & {
  isBanned: boolean;
  createdAt: string;
};

type UsersListResponse = { users: UserSummary[] };

export async function listUsers() {
  return httpClient<UsersListResponse>("/admin/users");
}

export async function updateUserRole(userId: string, role: Exclude<Role, "ADMIN">) {
  return httpClient<MessageResponse>(`/admin/users/${userId}/role`, "PATCH", { role });
}

export async function updateUserBanStatus(userId: string, isBanned: boolean) {
  return httpClient<MessageResponse>(`/admin/users/${userId}/ban`, "PATCH", { isBanned });
}

// ── Reports ──────────────────────────────────────────────────────────────────

export type MapIncident = {
  id: string;
  title: string;
  type: string;
  severity: string;
  latitude: number;
  longitude: number;
  description?: string;
  createdAt?: string;
};

export async function createEmergencyReport(payload: EmergencyReportSubmissionInput) {
  const formData = buildEmergencyReportFormData(payload);
  return httpClient<{ message: string; report: EmergencyReportSummary }>("/reports", "POST", formData);
}

export async function listCommunityReports(query: ReportListQuery = {}, signal?: AbortSignal) {
  return httpClient<{ reports: IncidentReportListItem[] }>(`/reports${toReportQueryString(query)}`, "GET", undefined, signal);
}

export async function listMyReports(query: ReportListQuery = {}, signal?: AbortSignal) {
  return httpClient<{ reports: IncidentReportListItem[] }>(`/reports/mine${toReportQueryString(query)}`, "GET", undefined, signal);
}

export async function getReportDetail(reportId: string) {
  return httpClient<ReportDetailResponse>(`/reports/${reportId}`);
}

export async function getMapReports() {
  return httpClient<MapIncident[]>("/reports/map");
}

// AC-05.04: Crisis event list — same data source as map, for accessible list alternative
export type CrisisEventListItem = {
  id: string;
  canonicalId: string | null;
  title: string;
  type: string;
  severity: string;
  status: string;
  location: string;
  sitRep: string | null;
  latitude: number | null;
  longitude: number | null;
  reportCount: number;
  reporterCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function listCrisisEvents(filters?: {
  incidentType?: string;
  severity?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.incidentType) params.set("incidentType", filters.incidentType);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();
  return httpClient<CrisisEventListItem[]>(`/reports/crisis-events${qs ? `?${qs}` : ""}`);
}

export async function listAdminUnpublishedReports(query: ReportListQuery = {}) {
  return httpClient<{ reports: IncidentReportListItem[] }>(`/admin/reports/unpublished${toReportQueryString(query)}`);
}

export async function updateReportStatusByAdmin(
  reportId: string,
  status: "PUBLISHED" | "UNDER_REVIEW" | "REJECTED" | "CLARIFICATION_REQUESTED" | "MERGED",
  reason?: string
) {
  return httpClient<{ message: string; report: { id: string; status: string; spamFlagged: boolean } }>(
    `/admin/reports/${reportId}/status`,
    "PATCH",
    { status, reason }
  );
}

function toReportQueryString(query: ReportListQuery) {
  const params = new URLSearchParams();

  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.severity && query.severity !== "ALL") params.set("severity", query.severity);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.order) params.set("order", query.order);
  if (typeof query.page === "number") params.set("page", String(query.page));
  if (typeof query.limit === "number") params.set("limit", String(query.limit));

  return buildQueryString(params);
}

// ── Volunteers ───────────────────────────────────────────────────────────────

export type VolunteerFilterQuery = {
  search?: string;
  skills?: string[];
  availability?: string[];
  minRating?: number;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  sortBy?: string;
};

type VolunteerProfileResponse = {
  volunteer: Pick<AuthUser, "id" | "fullName" | "email" | "location" | "role" | "skills" | "availability" | "certifications" | "avatarUrl"> & {
    isFlagged: boolean;
    volunteerFlagReasons: string[];
  };
};

type VolunteersListResponse = { volunteers: AuthUser[] };

export async function listVolunteers(query: VolunteerFilterQuery = {}) {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.skills?.length) params.set("skills", query.skills.join(","));
  if (query.availability?.length) params.set("availability", query.availability.join(","));
  if (query.minRating != null) params.set("minRating", String(query.minRating));
  if (query.lat != null) params.set("lat", String(query.lat));
  if (query.lng != null) params.set("lng", String(query.lng));
  if (query.radiusKm != null) params.set("radiusKm", String(query.radiusKm));
  if (query.sortBy) params.set("sortBy", query.sortBy);

  return httpClient<VolunteersListResponse>(`/volunteers${buildQueryString(params)}`);
}

export async function getVolunteerProfile(volunteerId: string) {
  return httpClient<VolunteerProfileResponse>(`/volunteers/${volunteerId}`);
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export async function submitReview(
  volunteerId: string,
  rating: number,
  text: string,
  interactionContext: string,
  interactionDate: string,
  wouldWorkAgain: boolean,
  crisisEventId: string
) {
  return httpClient<{ message: string; review: Review }>("/reviews", "POST", {
    volunteerId,
    rating,
    text,
    interactionContext,
    interactionDate,
    wouldWorkAgain,
    crisisEventId
  });
}

export async function getVolunteerReviews(volunteerId: string) {
  return httpClient<{ reviews: Review[]; averageRating: number | null }>(`/reviews/volunteer/${volunteerId}`);
}

export async function getEligibleReviewCrises(volunteerId: string) {
  return httpClient<{ crises: EligibleReviewCrisis[] }>(
    `/reviews/volunteer/${volunteerId}/eligible-crises`
  );
}

export async function getFlaggedReviews() {
  return httpClient<{ reviews: Review[] }>("/admin/reviews/flagged");
}

export async function getFlaggedVolunteers() {
  return httpClient<{ volunteers: FlaggedVolunteer[] }>("/admin/volunteers/flagged");
}

export async function approveReview(reviewId: string) {
  return httpClient<MessageResponse>(`/admin/reviews/${reviewId}/approve`, "PATCH");
}

export async function deleteReview(reviewId: string) {
  return httpClient<MessageResponse>(`/admin/reviews/${reviewId}`, "DELETE");
}

export async function approveVolunteer(volunteerId: string) {
  return httpClient<MessageResponse>(`/admin/volunteers/${volunteerId}/approve`, "PATCH");
}

export async function banVolunteer(volunteerId: string) {
  return httpClient<MessageResponse>(`/admin/volunteers/${volunteerId}/ban`, "POST");
}

// ── Dashboard ────────────────────────────────────────────────────────────────

type DashboardFeedResponse = { feed: CrisisEventCard[] };

export async function getDashboardFeed(
  filters: Partial<DashboardFeedFilters> & { lat?: number; lng?: number; radiusKm?: number } = {}
) {
  const params = new URLSearchParams();

  const defaults: DashboardFeedFilters = {
    incidentType: "ALL",
    severity: "ALL",
    timeRange: 0,
    sortBy: "mostRecent",
    sortOrder: "desc"
  };

  const merged = { ...defaults, ...filters };

  if (filters.lat != null) params.set("lat", String(filters.lat));
  if (filters.lng != null) params.set("lng", String(filters.lng));
  if (filters.radiusKm != null) params.set("radiusKm", String(filters.radiusKm));
  if (merged.incidentType !== "ALL") params.set("incidentType", merged.incidentType);
  if (merged.severity !== "ALL") params.set("severity", merged.severity);
  if (merged.timeRange > 0) params.set("timeRangeHours", String(merged.timeRange));
  if (merged.sortBy) params.set("sortBy", merged.sortBy);
  if (merged.sortOrder) params.set("sortOrder", merged.sortOrder);

  return httpClient<DashboardFeedResponse>(`/dashboard/feed${buildQueryString(params)}`);
}

export async function getSitRep(lat?: number, lng?: number, radiusKm?: number) {
  const params = new URLSearchParams();

  if (lat != null) params.set("lat", String(lat));
  if (lng != null) params.set("lng", String(lng));
  if (radiusKm != null) params.set("radius", String(radiusKm));

  return httpClient<SitRepResponse>(`/dashboard/sitrep${buildQueryString(params)}`);
}

export async function getAiAdvisories(lat?: number, lng?: number, radiusKm?: number) {
  const params = new URLSearchParams();

  if (lat != null) params.set("lat", String(lat));
  if (lng != null) params.set("lng", String(lng));
  if (radiusKm != null) params.set("radius", String(radiusKm));

  return httpClient<{ advisories: string[]; source: "ai" | "cache" | "default" }>(`/dashboard/advisories${buildQueryString(params)}`);
}

export async function getIncidentDetail(incidentId: string) {
  return httpClient<{ incident: IncidentDetailResponse }>(`/dashboard/incidents/${incidentId}`);
}

export function openCriticalIncidentStream(lat?: number, lng?: number, radiusKm?: number): EventSource {
  const params = new URLSearchParams();

  if (lat != null) params.set("lat", String(lat));
  if (lng != null) params.set("lng", String(lng));
  if (radiusKm != null) params.set("radius", String(radiusKm));

  return new EventSource(`${API_BASE}/dashboard/critical-incidents/stream${buildQueryString(params)}`, {
    withCredentials: true
  });
}

// ── Resources ────────────────────────────────────────────────────────────────

export type ResourceSummary = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  quantity: number;
  unit: string;
  address: string;
  contactPreference: string;
  status: string;
  notes?: string;
  photos?: string[];
  user?: {
    id: string;
    fullName: string;
    phone?: string;
    email?: string;
  };
};

export type ResourceDetail = ResourceSummary & {
  createdAt: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  photos?: string[];
  condition?: string;
  originalQuantity?: number | null;
};

export type AddResourcePayload = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  condition: string;
  address: string;
  latitude: number;
  longitude: number;
  availabilityStart?: string;
  availabilityEnd?: string;
  contactPreference: string;
  notes?: string;
  photos?: File[];
};

export type UpdateResourcePayload = {
  name: string;
  quantity: number;
  notes: string;
  status: string;
};

export type ResourceReservation = {
  id: string;
  userId: string;
  quantity: number;
  status: string;
  justification: string;
  pickupTime?: string | null;
  decisionReason?: string | null;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    location: string;
  };
};

export type ResourceHistoryEntry = {
  id: string;
  oldStatus: string;
  newStatus: string;
  oldQuantity: number;
  newQuantity: number;
  createdAt: string;
};

export async function getAllResources() {
  const data = await httpClient<{ resources: ResourceSummary[]; pagination: unknown }>("/resources/all");
  return data.resources;
}

export async function addResource(payload: AddResourcePayload) {
  const formData = new FormData();

  formData.append("name", payload.name);
  formData.append("category", payload.category);
  formData.append("quantity", String(payload.quantity));
  formData.append("unit", payload.unit);
  formData.append("condition", payload.condition);
  formData.append("address", payload.address);
  formData.append("latitude", String(payload.latitude));
  formData.append("longitude", String(payload.longitude));
  formData.append("contactPreference", payload.contactPreference);

  if (payload.availabilityStart) formData.append("availabilityStart", payload.availabilityStart);
  if (payload.availabilityEnd) formData.append("availabilityEnd", payload.availabilityEnd);
  if (payload.notes) formData.append("notes", payload.notes);
  payload.photos?.forEach((file) => formData.append("photos", file));

  return httpClient<{ id: string; name: string }>("/resources/add", "POST", formData);
}

export async function getMyResources() {
  return httpClient<ResourceDetail[]>("/resources/my");
}

export async function updateResource(resourceId: string, payload: UpdateResourcePayload) {
  return httpClient<{ message: string; resource: UpdateResourcePayload }>(
    `/resources/update/${resourceId}`,
    "PATCH",
    payload
  );
}

export async function deactivateResource(resourceId: string) {
  return httpClient<{ message: string; resource: { id: string; status: string } }>(
    `/resources/deactivate/${resourceId}`,
    "PATCH"
  );
}

export async function deleteResource(resourceId: string) {
  return httpClient<MessageResponse>(`/resources/delete/${resourceId}`, "DELETE");
}

export const getReservationsForResource = (resourceId: string) =>
  request<ResourceReservation[]>(`/resources/${resourceId}/reservations`);

export const getResourceHistory = (resourceId: string) =>
  request<ResourceHistoryEntry[]>(`/resources/${resourceId}/history`);

export const approveReservationApi = (id: string) =>
  request(`/resources/reservation/${id}/approve`, { method: "PATCH" });

export const declineReservationApi = (id: string, reason?: string) =>
  request(`/resources/reservation/${id}/decline`, {
    method: "PATCH",
    body: reason ? { reason } : undefined
  });


export const createReservationApi = (payload: {
  resourceId: string;
  quantity: number;
  justification: string;
  pickupTime?: string | null;
}) =>
  request("/resources/reserve", {
    method: "POST",
    body: payload
  });

// ── Crisis Updates (Module 3.1) ──────────────────────────────────────────────

export async function submitCrisisUpdate(crisisEventId: string, payload: CrisisUpdateInput) {
  return httpClient<{ entry: CrisisUpdateEntry; applied: boolean }>(
    `/crises/${crisisEventId}/updates`,
    "POST",
    payload
  );
}

export async function getCrisisUpdates(crisisEventId: string) {
  return httpClient<{ entries: CrisisUpdateEntry[] }>(`/crises/${crisisEventId}/updates`);
}

export async function dismissFlaggedUpdate(updateId: string) {
  return httpClient<MessageResponse>(`/crises/updates/${updateId}/dismiss`, "PATCH");
}

export async function approveFlaggedUpdateApi(updateId: string) {
  return httpClient<{ message: string; pointsAwarded: number }>(`/crises/updates/${updateId}/approve`, "PATCH");
}

export async function revertCrisisStatus(crisisEventId: string, targetStatus: string, note: string) {
  return httpClient<MessageResponse>(`/crises/${crisisEventId}/revert`, "PATCH", {
    targetStatus,
    note
  });
}

// ── Conflict resolution (admin) ─────────────────────────────────────────────
export type ConflictResolutionEntry = {
  id: string;
  crisisEventId: string;
  crisisTitle: string;
  recommendation: string;
  reasoning: string | null;
  recommendedUpdateId: string | null;
  updateIds: string[];
  resolved: boolean;
  createdAt: string;
};

export async function getUnresolvedConflicts(crisisEventId?: string) {
  const query = crisisEventId ? `?crisisEventId=${crisisEventId}` : "";
  return httpClient<{ conflicts: ConflictResolutionEntry[] }>(`/crises/conflicts${query}`);
}

export async function resolveConflict(conflictId: string, acceptedUpdateId: string) {
  return httpClient<MessageResponse>(`/crises/conflicts/${conflictId}/resolve`, "PATCH", {
    acceptedUpdateId
  });
}

// ── Responder approval (admin, suspend/reinstate only) ──────────────────────
export async function suspendResponder(userId: string) {
  return httpClient<{ message: string }>(`/admin/responders/${userId}/suspend`, "PATCH");
}

export async function reinstateResponder(userId: string) {
  return httpClient<{ message: string }>(`/admin/responders/${userId}/reinstate`, "PATCH");
}

export async function getCrisisResponders(crisisEventId: string) {
  return httpClient<{ responders: CrisisResponder[]; myStatus: CrisisResponderStatus | null }>(
    `/crises/${crisisEventId}/responders`
  );
}

export async function updateMyCrisisResponderStatus(
  crisisEventId: string,
  status: CrisisResponderStatus
) {
  return httpClient<{ message: string; responder: CrisisResponder }>(
    `/crises/${crisisEventId}/responders/me`,
    "PATCH",
    { status }
  );
}

// ── Trust Tier System ───────────────────────────────────────────────────────

export async function getTrustTierInfoApi() {
  return httpClient<TrustTierInfo>(`/profile/trust-tier`);
}

export async function createVouchApi(payload: {
  vouchedForId: string;
  reason: string;
  crisisEventId?: string | null;
}) {
  return httpClient<{ message: string; vouch: Vouch }>(`/vouch`, "POST", payload);
}

export async function getVouchesReceivedApi() {
  return httpClient<{ vouches: Vouch[] }>(`/vouch/received`);
}

export async function getVouchesGivenApi() {
  return httpClient<{ vouches: Vouch[] }>(`/vouch/given`);
}

// ── Crisis Chat ─────────────────────────────────────────────────────────────

export async function getCrisisMessagesApi(crisisEventId: string, page = 1, limit = 50) {
  return httpClient<CrisisMessageListResponse>(
    `/crises/${crisisEventId}/messages?page=${page}&limit=${limit}`
  );
}

export async function sendCrisisMessageApi(crisisEventId: string, content: string) {
  return httpClient<{ message: string; data: CrisisMessage }>(
    `/crises/${crisisEventId}/messages`,
    "POST",
    { content }
  );
}

export async function deleteCrisisMessageApi(messageId: string) {
  return httpClient<{ message: string }>(`/crises/messages/${messageId}`, "DELETE");
}

export async function togglePinCrisisMessageApi(messageId: string) {
  return httpClient<{ message: string; isPinned: boolean }>(
    `/crises/messages/${messageId}/pin`,
    "PATCH"
  );
}

export function openCrisisChatStream(crisisEventId: string): EventSource {
  return new EventSource(`${API_BASE}/crises/${crisisEventId}/messages/stream`, {
    withCredentials: true
  });
}

// ── Notifications (Module 3.5) ───────────────────────────────────────────────

export type NotificationPreferencesInput = {
  incidentTypes: string[];
  radiusKm: number;
  isActive: boolean;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  survivalInstruction: string | null;
  isRead: boolean;
  crisisEventId: string | null;
  createdAt: string;
  reservationId: string | null;
  type: string | null;
};

export async function getNotificationPreferences() {
  return httpClient<{ incidentTypes: string[]; radiusKm: number; isActive: boolean }>(
    "/notifications/preferences"
  );
}

export async function updateNotificationPreferences(payload: NotificationPreferencesInput) {
  return httpClient<MessageResponse>("/notifications/preferences", "PUT", payload);
}

export async function getNotifications(page = 1, limit = 20) {
  return httpClient<{ notifications: NotificationItem[]; unreadCount: number; total: number }>(
    `/notifications/inbox?page=${page}&limit=${limit}`
  );
}

export async function markNotificationRead(notificationId: string) {
  return httpClient<MessageResponse>(`/notifications/inbox/${notificationId}/read`, "PATCH");
}

export async function markAllNotificationsRead() {
  return httpClient<MessageResponse>("/notifications/inbox/read-all", "POST");
}

export async function clearHandledNotifications() {
  return httpClient<MessageResponse>("/notifications/inbox/clear-handled", "DELETE");
}

export type NGOReportResource = {
  name: string;
  amount: string;
};

export type ReportSections = {
  executiveSummary: string;
  incidentDetails: string;
  timeline: string;
  resourceUtilization: string;
  volunteerInvolvement: string;
  evidenceSummary: string;
  impactAssessment: string;
  appendix: string;
};

export type NGOReport = {
  id: string;
  crisisEventId: string;
  generatedById: string;
  title: string;
  fileUrl: string | null;
  summary: string | null;
  sectionsJson: string | null;
  pdfGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  crisisEvent?: { title: string };
  generatedBy?: { fullName: string };
};

export async function listNGOReports(crisisId?: string) {
  const query = crisisId ? `?crisisId=${encodeURIComponent(crisisId)}` : "";
  return httpClient<NGOReport[]>(`/ngo-reports${query}`);
}

export async function generateNGOReport(
  crisisId: string,
  payload: {
    assignedVolunteers?: string[];
    resources?: NGOReportResource[];
  } = {}
) {
  return httpClient<NGOReport>(`/ngo-reports/${crisisId}`, "POST", payload);
}

// Create a draft after-action report with editable sections
export async function createDraftReport(crisisId: string) {
  return httpClient<NGOReport>(`/ngo-reports/crises/${crisisId}/draft`, "POST");
}

// Update editable sections of a report
export async function updateReportSections(reportId: string, sections: Partial<ReportSections>) {
  return httpClient<NGOReport>(`/ngo-reports/${reportId}/sections`, "PATCH", sections);
}

// Generate the final PDF from edited sections
export async function generateReportPDF(reportId: string) {
  return httpClient<NGOReport>(`/ngo-reports/${reportId}/generate-pdf`, "POST");
}

export type OCRItem = {
  id: string;
  scanId: string;
  text: string;
  confidence: number | null;
  category: string;
  bboxLeft: number | null;
  bboxTop: number | null;
  bboxWidth: number | null;
  bboxHeight: number | null;
  createdAt: string;
  updatedAt: string;
};

export type OCRScan = {
  id: string;
  userId: string;
  folderId: string | null;
  fileId: string | null;
  crisisEventId: string | null;
  incidentReportId: string | null;
  sourceImageUrl: string;
  sourceFileName: string;
  provider: string;
  status: string;
  rawText: string;
  createdAt: string;
  updatedAt: string;
  items: OCRItem[];
  folder?: { id: string; name: string } | null;
  crisisEvent?: { id: string; title: string } | null;
  incidentReport?: { id: string; incidentTitle: string } | null;
};

export async function uploadOCRImage(payload: {
  image: File;
  folderId?: string | null;
  crisisEventId?: string | null;
  incidentReportId?: string | null;
  aiConsent?: boolean;
}) {
  const formData = new FormData();
  formData.append("image", payload.image);
  formData.append("aiConsent", String(payload.aiConsent ?? false));
  if (payload.folderId) formData.append("folderId", payload.folderId);
  if (payload.crisisEventId) formData.append("crisisEventId", payload.crisisEventId);
  if (payload.incidentReportId) formData.append("incidentReportId", payload.incidentReportId);

  return httpClient<{ scan: OCRScan }>("/ocr/upload", "POST", formData);
}

export async function scanDocumentFile(folderId: string, fileId: string) {
  return httpClient<{ scan: OCRScan }>(`/ocr/folders/${folderId}/files/${fileId}`, "POST", {});
}

export async function getOCRHistory(page = 1, limit = 20) {
  return httpClient<{ scans: OCRScan[]; total: number; page: number; limit: number }>(
    `/ocr/history?page=${page}&limit=${limit}`
  );
}

export async function getOCRScan(scanId: string) {
  return httpClient<{ scan: OCRScan }>(`/ocr/${scanId}`);
}

export async function updateOCRItem(scanId: string, itemId: string, payload: { text: string; category?: string }) {
  return httpClient<{ item: OCRItem }>(`/ocr/${scanId}/items/${itemId}`, "PATCH", payload);
}

export async function attachOCRScan(scanId: string, payload: {
  folderId?: string | null;
  crisisEventId?: string | null;
  incidentReportId?: string | null;
}) {
  return httpClient<{ scan: OCRScan }>(`/ocr/${scanId}/attach`, "PATCH", payload);
}

// ── Timesheet & Gamification (Feature 3.7) ─────────────────────────────────

export async function logTaskApi(payload: {
  title: string;
  description: string;
  category: string;
  hoursSpent: number;
  dateOfTask: string;
  crisisEventId?: string | null;
}, files?: File[]) {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("description", payload.description);
  formData.append("category", payload.category);
  formData.append("hoursSpent", String(payload.hoursSpent));
  formData.append("dateOfTask", payload.dateOfTask);
  
  if (payload.crisisEventId) {
    formData.append("crisisEventId", payload.crisisEventId);
  }
  
  if (files && files.length > 0) {
    files.forEach(f => formData.append("evidence", f));
  }

  return httpClient<{ message: string; task: VolunteerTask }>("/timesheet/tasks", "POST", formData);
}

export async function getMyTimesheetApi(page = 1, limit = 20) {
  return httpClient<{
    tasks: VolunteerTask[];
    total: number;
    summary: TimesheetSummary;
  }>(`/timesheet/my?page=${page}&limit=${limit}`);
}

export async function getLeaderboardApi(period: "all" | "month" | "week" = "all", limit = 50) {
  return httpClient<{ entries: LeaderboardEntry[]; period: string }>(
    `/timesheet/leaderboard?period=${period}&limit=${limit}`
  );
}

export async function getPendingTasksApi(page = 1, limit = 20) {
  return httpClient<{ tasks: VolunteerTask[]; total: number }>(`/timesheet/tasks/pending?page=${page}&limit=${limit}`);
}

export async function verifyTaskApi(taskId: string, decision: "VERIFIED" | "REJECTED", rejectionReason?: string) {
  return httpClient<{ message: string; pointsAwarded: number }>(`/timesheet/tasks/${taskId}/verify`, "PATCH", {
    decision,
    rejectionReason
  });
}

export async function getCrisesForDropdownApi() {
  return httpClient<{ crises: { id: string; title: string; status: string; incidentType: string }[] }>("/timesheet/crises");
}

// ── Admin: Trust Tier Oversight ─────────────────────────────────────────────

export async function getTrustTierVolunteersApi() {
  return httpClient<{ volunteers: TrustTierVolunteer[] }>("/admin/trust-tiers");
}

// ── Copilot ──────────────────────────────────────────────────────────────────

export async function askCopilotApi(crisisEventId: string, question: string) {
  return httpClient<{
    crisisEventId: string;
    question: string;
    answer: string;
    sourcesUsed: Array<{ type: string; id: string; label?: string }>;
    assumptions: string[];
    degraded?: boolean;
  }>("/copilot/query", "POST", { crisisEventId, question });
}

export type CopilotDraft = {
  id: string;
  crisisEventId: string;
  draftType: string;
  payload: string;
  status: string;
  reasoning: string;
  versionAtCreation: number;
  expiresAt: string;
  proposedById: string;
  confirmedById: string | null;
  confirmedAt: string | null;
  createdAt: string;
  sourceIds?: string[];
  crisisEvent?: { id: string; title: string; version: number };
  proposedBy?: { id: string; fullName: string };
  confirmedBy?: { id: string; fullName: string } | null;
};

export async function listCopilotDraftsApi(crisisEventId: string, status?: string) {
  const query = status ? `?status=${status}` : "";
  return httpClient<{ drafts: CopilotDraft[] }>(`/copilot/drafts/${crisisEventId}${query}`);
}

export async function createCopilotDraftApi(input: {
  crisisEventId: string;
  draftType: string;
  reasoning: string;
  payload: Record<string, unknown>;
}) {
  return httpClient<{ draft: CopilotDraft }>("/copilot/drafts", "POST", input);
}

export async function confirmCopilotDraftApi(draftId: string) {
  return httpClient<{ draft: CopilotDraft; executionResult: unknown }>(`/copilot/drafts/${draftId}/confirm`, "POST");
}

export async function rejectCopilotDraftApi(draftId: string, reason?: string) {
  return httpClient<{ draft: CopilotDraft }>(`/copilot/drafts/${draftId}/reject`, "POST", { reason: reason ?? "" });
}

// ── Claims ───────────────────────────────────────────────────────────────────

export type ClaimSummary = {
  total: number;
  byState: Record<string, number>;
};

export type ClaimContradiction = {
  id: string;
  reason: string;
  fromClaim: { id: string; subject: string; value: string };
  toClaim: { id: string; subject: string; value: string };
};

export type ClaimItem = {
  id: string;
  claimType: string;
  subject: string;
  value: string;
  unit?: string;
  evidenceState: string;
  sourceText?: string;
  supportCount: number;
  conflictCount: number;
  needsHumanDecision: boolean;
  incidentReport?: { incidentTitle: string } | null;
};

export type ClaimsResponse = {
  claims: ClaimItem[];
  summary: ClaimSummary;
  contradictions: ClaimContradiction[];
};

export async function getClaimsForCrisis(crisisEventId: string) {
  return httpClient<ClaimsResponse>(`/claims/crisis/${crisisEventId}`);
}

export async function decideClaimApi(claimId: string, decision: string, note?: string) {
  return httpClient<{ message: string }>(`/claims/${claimId}/decide`, "PATCH", { decision, reason: note ?? "" });
}

// ── Needs ────────────────────────────────────────────────────────────────────
// needRoutes are mounted at /needs in the backend.

export async function getNeedsApi(crisisEventId: string) {
  return httpClient<{ needs: unknown[] }>(`/needs/crisis/${crisisEventId}`);
}

export async function getNeedsGapApi(crisisEventId: string) {
  return httpClient<{ gaps: unknown[] }>(`/needs/gap/${crisisEventId}`);
}

export async function createNeedApi(input: {
  crisisEventId: string;
  needType: string;
  description: string;
  quantity: number;
  unit: string;
  urgency: string;
}) {
  return httpClient<{ need: unknown }>("/needs", "POST", input);
}

// ── Generic API fetch (for pages that use raw fetch) ──────────────────────────

export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  // Add CSRF header for state-changing requests (double-submit cookie pattern)
  if (init?.method && ["POST", "PATCH", "PUT", "DELETE"].includes(init.method)) {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    const csrfToken = csrfMatch?.[1];
    if (csrfToken) headers["x-csrf-token"] = csrfToken;
  }
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers,
    credentials: "include",
  });

  // 401: session expired — notify the app to redirect to login
  if (response.status === 401 && !endpoint.startsWith("/auth/")) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  return response;
}

export type VelocityMetricsResponse = {
  claimsLastHour: number;
  claimsPrevHour: number;
  velocitySurgePercent: number;
  escalationRiskScore: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  predictiveSummary: string;
};

export async function getCrisisVelocityApi(crisisEventId: string): Promise<VelocityMetricsResponse> {
  return httpClient<VelocityMetricsResponse>(`/briefs/crisis/${crisisEventId}/velocity`);
}
