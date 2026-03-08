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

