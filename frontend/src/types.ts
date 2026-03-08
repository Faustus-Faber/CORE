export type Role = "USER" | "VOLUNTEER" | "ADMIN";

export interface AuthUser {
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
}

// --- SECURE DOCUMENTATION TYPES ---

export interface FolderFile {
  id: string;
  folderId: string;
  uploaderId: string;
  fileName: string;
  fileUrl: string; // The URL from your storage provider
  fileType: string; // e.g., 'image/jpeg', 'video/mp4'
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
  // Included when fetching folder lists
  _count?: {
    files: number;
    notes: number;
  };
  // Included when fetching a specific folder's details
  files?: FolderFile[];
  notes?: FolderNote[];
}