import { request } from "./api";

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    fullName: string;
    avatarUrl: string | null;
  };
}

export interface EvidencePost {
  id: string;
  userId: string;
  title: string;
  description: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  mediaUrls: string[];
  mediaType: 'IMAGE' | 'VIDEO';
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    fullName: string;
    avatarUrl: string | null;
    role: string;
  };
  comments: Comment[];
  likes: { userId: string }[];
  _count: {
    likes: number;
    comments: number;
  };
}

export async function listEvidencePosts(params?: { filter?: string; sort?: string }): Promise<EvidencePost[]> {
  const query = new URLSearchParams();
  if (params?.filter) query.append("filter", params.filter);
  if (params?.sort) query.append("sort", params.sort);
  
  const queryString = query.toString();
  return request(`/evidence${queryString ? `?${queryString}` : ""}`);
}

export async function createEvidencePost(formData: FormData): Promise<{ message: string; post: EvidencePost }> {
  return request("/evidence", {
    method: "POST",
    body: formData,
  });
}

export async function updateEvidencePost(id: string, payload: { title: string; description: string }): Promise<EvidencePost> {
  return request(`/evidence/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteEvidencePost(id: string): Promise<{ message: string }> {
  return request(`/evidence/${id}`, {
    method: "DELETE",
  });
}

export async function toggleLikePost(id: string): Promise<{ liked: boolean }> {
  return request(`/evidence/${id}/like`, {
    method: "POST",
  });
}

export async function addComment(id: string, content: string): Promise<Comment> {
  return request(`/evidence/${id}/comment`, {
    method: "POST",
    body: { content },
  });
}

export async function verifyEvidencePost(id: string): Promise<{ message: string; post: EvidencePost }> {
  return request(`/evidence/${id}/verify`, {
    method: "POST",
  });
}

export async function flagEvidencePost(id: string, reason: string): Promise<{ message: string }> {
  return request(`/evidence/${id}/flag`, {
    method: "POST",
    body: { reason },
  });
}
