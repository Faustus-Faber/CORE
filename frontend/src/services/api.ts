import type {
  AuthUser,
  IncidentReportListItem,
  EmergencyReportSubmissionInput,
  EmergencyReportSummary,
  ReportListQuery,
  Role,
  Review,
  FlaggedVolunteer
} from "../types";
import { buildEmergencyReportFormData } from "./reportPayload";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

type RequestOptions = {
  method?: string;
  body?: unknown;
};

type ApiValidationIssue = {
  path?: string;
  message?: string;
};

type ApiErrorPayload = {
  message?: string;
  issues?: ApiValidationIssue[];
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? undefined
    : {
        "Content-Type": "application/json"
      };

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body
      ? isFormData
        ? (options.body as FormData)
        : JSON.stringify(options.body)
      : undefined
  });

  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;

  if (!response.ok) {
    if (Array.isArray(payload.issues) && payload.issues.length > 0) {
      const details = payload.issues
        .map((issue) =>
          issue.path ? `${issue.path}: ${issue.message ?? "Invalid value"}` : issue.message
        )
        .filter(Boolean)
        .join(" | ");

      throw new Error(details || payload.message || "Validation failed");
    }

    throw new Error(payload.message ?? "Request failed");
  }

  return payload as T;
}

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

export async function registerUser(payload: RegisterPayload) {
  return request<{ message: string; user: AuthUser }>("/auth/register", {
    method: "POST",
    body: payload
  });
}

export async function loginUser(payload: LoginPayload) {
  return request<{ message: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: payload
  });
}

export async function getCurrentUser() {
  return request<{ user: AuthUser }>("/auth/me");
}

export async function logoutUser() {
  return request<{ message: string }>("/auth/logout", {
    method: "POST"
  });
}

export async function forgotPassword(email: string) {
  return request<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { email }
  });
}

export async function resetPassword(
  token: string,
  password: string,
  confirmPassword: string
) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: { token, password, confirmPassword }
  });
}

export async function updateProfile(payload: Partial<AuthUser>) {
  return request<{ message: string; profile: AuthUser }>("/profile", {
    method: "PATCH",
    body: payload
  });
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}) {
  return request<{ message: string }>("/profile/change-password", {
    method: "POST",
    body: payload
  });
}

export async function listUsers() {
  return request<{
    users: Array<
      Pick<AuthUser, "id" | "fullName" | "email" | "phone" | "location" | "role"> & {
        isBanned: boolean;
        createdAt: string;
      }
    >;
  }>("/admin/users");
}

export async function updateUserRole(userId: string, role: Exclude<Role, "ADMIN">) {
  return request<{ message: string }>(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role }
  });
}

export async function updateUserBanStatus(userId: string, isBanned: boolean) {
  return request<{ message: string }>(`/admin/users/${userId}/ban`, {
    method: "PATCH",
    body: { isBanned }
  });
}

export async function createEmergencyReport(
  payload: EmergencyReportSubmissionInput
) {
  const formData = buildEmergencyReportFormData(payload);
  return request<{ message: string; report: EmergencyReportSummary }>("/reports", {
    method: "POST",
    body: formData
  });
}

function toQueryString(query: ReportListQuery) {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }

  if (query.severity && query.severity !== "ALL") {
    params.set("severity", query.severity);
  }

  if (query.sortBy) {
    params.set("sortBy", query.sortBy);
  }

  if (query.order) {
    params.set("order", query.order);
  }

  if (typeof query.page === "number") {
    params.set("page", String(query.page));
  }

  if (typeof query.limit === "number") {
    params.set("limit", String(query.limit));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listCommunityReports(query: ReportListQuery = {}) {
  return request<{ reports: IncidentReportListItem[] }>(
    `/reports${toQueryString(query)}`
  );
}

export async function listMyReports(query: ReportListQuery = {}) {
  return request<{ reports: IncidentReportListItem[] }>(
    `/reports/mine${toQueryString(query)}`
  );
}

export async function listAdminUnpublishedReports(query: ReportListQuery = {}) {
  return request<{ reports: IncidentReportListItem[] }>(
    `/admin/reports/unpublished${toQueryString(query)}`
  );
}

export async function updateReportStatusByAdmin(
  reportId: string,
  status: "PUBLISHED" | "UNDER_REVIEW"
) {
  return request<{
    message: string;
    report: {
      id: string;
      status: "PUBLISHED" | "UNDER_REVIEW";
      spamFlagged: boolean;
    };
  }>(`/admin/reports/${reportId}/status`, {
    method: "PATCH",
    body: { status }
  });
}

// ── Volunteers ──────────────────────────────────────────────────────────────

export async function listVolunteers(query?: { skill?: string; location?: string }) {
  const params = new URLSearchParams();
  if (query?.skill) params.set("skill", query.skill);
  if (query?.location) params.set("location", query.location);
  const queryString = params.toString() ? `?${params.toString()}` : "";

  return request<{
    volunteers: Array<Pick<AuthUser, "id" | "fullName" | "email" | "location"> & { skills?: string[] }>;
  }>(`/volunteers${queryString}`);
}

export async function getVolunteerProfile(volunteerId: string) {
  return request<{
    volunteer: Pick<
      AuthUser,
      | "id"
      | "fullName"
      | "email"
      | "location"
      | "role"
      | "skills"
      | "availability"
      | "certifications"
      | "avatarUrl"
    > & {
      isFlagged: boolean;
      volunteerFlagReasons: string[];
    };
  }>(`/volunteers/${volunteerId}`);
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export async function submitReview(
  volunteerId: string,
  rating: number,
  text: string,
  interactionContext: string,
  interactionDate: string,
  wouldWorkAgain: boolean,
  crisisEventId?: string | null
) {
  return request<{ message: string; review: Review }>("/reviews", {
    method: "POST",
    body: {
      volunteerId,
      rating,
      text,
      interactionContext,
      interactionDate,
      wouldWorkAgain,
      crisisEventId
    }
  });
}

export async function getVolunteerReviews(volunteerId: string) {
  return request<{ reviews: Review[]; averageRating: number | null }>(
    `/reviews/volunteer/${volunteerId}`
  );
}

export async function getFlaggedReviews() {
  return request<{ reviews: Review[] }>("/reviews/flagged");
}

export async function getFlaggedVolunteers() {
  return request<{ volunteers: FlaggedVolunteer[] }>("/reviews/flagged-volunteers");
}

export async function approveReview(reviewId: string) {
  return request<{ message: string }>(`/reviews/${reviewId}/approve`, {
    method: "PATCH"
  });
}

export async function deleteReview(reviewId: string) {
  return request<{ message: string }>(`/reviews/${reviewId}`, {
    method: "DELETE"
  });
}

export async function approveVolunteer(volunteerId: string) {
  return request<{ message: string }>(`/reviews/volunteer/${volunteerId}/approve`, {
    method: "PATCH"
  });
}

export async function banVolunteer(volunteerId: string) {
  return request<{ message: string }>(`/reviews/volunteer/${volunteerId}/ban`, {
    method: "POST"
  });
}
