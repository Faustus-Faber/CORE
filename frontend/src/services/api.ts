import type { AuthUser, Role } from "../types";

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
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined
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
  const res = await request<{ message: string; user: AuthUser; token: string }>("/auth/login", {
    method: "POST",
    body: payload,
  });
  localStorage.setItem("token", res.token);
  return { user: res.user };
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
