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
  VolunteerTask,
  Role,
  SitRepResponse,
  Review
} from "../types";
import { buildEmergencyReportFormData } from "./reportPayload";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

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

async function httpClient<T>(endpoint: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const isFormData = body instanceof FormData;

  const init: RequestInit = {
    method,
    headers: isFormData ? undefined : { "Content-Type": "application/json" },
    body: serializeBody(body, isFormData)
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    credentials: "include"
  });

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

export async function listCommunityReports(query: ReportListQuery = {}) {
  return httpClient<{ reports: IncidentReportListItem[] }>(`/reports${toReportQueryString(query)}`);
}

export async function listMyReports(query: ReportListQuery = {}) {
  return httpClient<{ reports: IncidentReportListItem[] }>(`/reports/mine${toReportQueryString(query)}`);
}

export async function getReportDetail(reportId: string) {
  return httpClient<ReportDetailResponse>(`/reports/${reportId}`);
}

export async function getMapReports() {
  return httpClient<MapIncident[]>("/reports/map");
}

export async function listAdminUnpublishedReports(query: ReportListQuery = {}) {
  return httpClient<{ reports: IncidentReportListItem[] }>(`/admin/reports/unpublished${toReportQueryString(query)}`);
}

export async function updateReportStatusByAdmin(reportId: string, status: "PUBLISHED" | "UNDER_REVIEW") {
  return httpClient<{ message: string; report: { id: string; status: string; spamFlagged: boolean } }>(
    `/admin/reports/${reportId}/status`,
    "PATCH",
    { status }
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
  return httpClient<{ reviews: Review[] }>("/reviews/flagged");
}

export async function getFlaggedVolunteers() {
  return httpClient<{ volunteers: FlaggedVolunteer[] }>("/reviews/flagged-volunteers");
}

export async function approveReview(reviewId: string) {
  return httpClient<MessageResponse>(`/reviews/${reviewId}/approve`, "PATCH");
}

export async function deleteReview(reviewId: string) {
  return httpClient<MessageResponse>(`/reviews/${reviewId}`, "DELETE");
}

export async function approveVolunteer(volunteerId: string) {
  return httpClient<MessageResponse>(`/reviews/volunteer/${volunteerId}/approve`, "PATCH");
}

export async function banVolunteer(volunteerId: string) {
  return httpClient<MessageResponse>(`/reviews/volunteer/${volunteerId}/ban`, "POST");
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
  return httpClient<ResourceSummary[]>("/resources/all");
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

export async function revertCrisisStatus(crisisEventId: string, targetStatus: string, note: string) {
  return httpClient<MessageResponse>(`/crises/${crisisEventId}/revert`, "PATCH", {
    targetStatus,
    note
  });
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

export type NGOReport = {
  id: string;
  crisisEventId: string;
  generatedById: string;
  title: string;
  fileUrl: string;
  createdAt: string;
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
