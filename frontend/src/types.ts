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
