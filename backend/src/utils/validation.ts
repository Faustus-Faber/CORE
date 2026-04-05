import { z } from "zod";

const phoneRegex = /^\+?[0-9]{10,15}$/;
const hasMixedPasswordTypes = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    hasMixedPasswordTypes,
    "Password must include uppercase, lowercase, number, and symbol"
  );

const roleSchema = z.enum(["USER", "VOLUNTEER", "ADMIN"]);

// ==================== AUTH SCHEMAS ====================

export const registrationSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required").max(120),
    email: z.string().email("Invalid email format"),
    phone: z.string().regex(phoneRegex, "Invalid phone format"),
    password: passwordSchema,
    confirmPassword: z.string(),
    location: z.string().min(2, "Location is required").max(200),
    role: roleSchema.refine((value) => value !== "ADMIN", {
      message: "Admin role cannot be self-registered"
    }),
    skills: z.array(z.string()).optional(),
    availability: z.string().optional(),
    certifications: z.string().max(400).optional()
  })
  .superRefine((payload, context) => {
    if (payload.password !== payload.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"]
      });
    }

    if (
      payload.role === "VOLUNTEER" &&
      (!payload.skills?.length || !payload.availability?.trim())
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Volunteer skills and availability are required",
        path: ["skills"]
      });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format")
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .superRefine((payload, context) => {
    if (payload.password !== payload.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"]
      });
    }
  });

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().regex(phoneRegex, "Invalid phone format").optional(),
  location: z.string().min(2).max(200).optional(),
  avatarUrl: z.string().url("Avatar must be a valid URL").optional(),
  skills: z.array(z.string()).optional(),
  availability: z.string().optional(),
  certifications: z.string().max(400).optional(),
  dispatchOptIn: z.boolean().optional()
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string()
  })
  .superRefine((payload, context) => {
    if (payload.newPassword !== payload.confirmNewPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmNewPassword"]
      });
    }
  });

export function validateRegistrationInput(payload: unknown) {
  return registrationSchema.parse(payload);
}

// ==================== FEATURE 1: EMERGENCY REPORTING ====================

const incidentTypeSchema = z.enum([
  "FLOOD",
  "FIRE",
  "EARTHQUAKE",
  "BUILDING_COLLAPSE",
  "ROAD_ACCIDENT",
  "VIOLENCE",
  "MEDICAL_EMERGENCY",
  "OTHER"
]);

const incidentSeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

const voiceMimeTypes = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm"
] as const;

const uploadedFileSchema = z.object({
  originalname: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().int().positive()
});

export const reportSubmissionSchema = z
  .object({
    incidentTitle: z
      .string()
      .trim()
      .min(1, "Incident title is required")
      .max(120, "Incident title must be at most 120 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be at most 2000 characters")
      .optional()
      .default(""),
    incidentType: incidentTypeSchema,
    locationText: z
      .string()
      .trim()
      .min(2, "Location is required")
      .max(300, "Location must be at most 300 characters"),
    mediaFiles: z.array(uploadedFileSchema).max(5).default([]),
    voiceFile: uploadedFileSchema.optional()
  })
  .superRefine((payload, context) => {
    const hasDescription = payload.description.trim().length > 0;

    if (!hasDescription && !payload.voiceFile) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Description or voice note is required"
      });
    }

    for (const mediaFile of payload.mediaFiles) {
      if (mediaFile.size > 10 * 1024 * 1024) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mediaFiles"],
          message: "Each media file must be 10MB or less"
        });
      }

      const isAllowedMedia =
        mediaFile.mimetype.startsWith("image/") ||
        mediaFile.mimetype.startsWith("video/");
      if (!isAllowedMedia) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mediaFiles"],
          message: "Media files must be images or videos"
        });
      }
    }

    if (payload.voiceFile) {
      if (payload.voiceFile.size > 10 * 1024 * 1024) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["voiceFile"],
          message: "Voice note must be 10MB or less"
        });
      }

      if (!voiceMimeTypes.includes(payload.voiceFile.mimetype as never)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["voiceFile"],
          message: "Voice note format is not supported"
        });
      }
    }
  });

export const reportListQuerySchema = z.object({
  search: z.coerce.string().trim().max(120).optional().default(""),
  severity: z
    .union([incidentSeveritySchema, z.literal("ALL")])
    .optional()
    .default("ALL"),
  sortBy: z
    .enum(["createdAt", "severity", "credibility"])
    .optional()
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(12).optional().default(8)
});

export function validateReportSubmissionInput(payload: unknown) {
  return reportSubmissionSchema.parse(payload);
}

export function validateReportListQueryInput(payload: unknown) {
  return reportListQuerySchema.parse(payload);
}

// ==================== FEATURE 2: RESOURCE REGISTRATION ====================

const resourceCategorySchema = z.enum([
  "Medical Supplies",
  "Food & Water",
  "Shelter",
  "Clothing",
  "Transportation",
  "Tools & Equipment",
  "Other"
]);

const resourceUnitSchema = z.enum([
  "pieces",
  "packs",
  "liters",
  "kg",
  "units",
  "seats",
  "other"
]);

const resourceConditionSchema = z.enum(["New", "Good", "Fair"]);

const resourceContactPreferenceSchema = z.enum(["Phone", "SMS", "In-App"]);

export const createResourceSchema = z.object({
  name: z.string().min(1, "Resource name is required").max(100),
  category: resourceCategorySchema,
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unit: resourceUnitSchema,
  condition: resourceConditionSchema,
  address: z.string().min(1, "Address is required").max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  availabilityStart: z.string().datetime().optional().or(z.literal("")),
  availabilityEnd: z.string().datetime().optional().or(z.literal("")),
  contactPreference: resourceContactPreferenceSchema,
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().or(z.literal("")),
  photos: z.array(z.string()).optional()
});

export const updateResourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: resourceCategorySchema.optional(),
  quantity: z.number().min(1).optional(),
  unit: resourceUnitSchema.optional(),
  condition: resourceConditionSchema.optional(),
  address: z.string().min(1).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactPreference: resourceContactPreferenceSchema.optional(),
  availabilityStart: z.string().datetime().optional().or(z.literal("")),
  availabilityEnd: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  photos: z.array(z.string()).optional(),
  status: z.enum(["Available", "Low Stock", "Reserved", "Depleted", "Unavailable"]).optional()
});

export function validateCreateResourceInput(payload: unknown) {
  return createResourceSchema.parse(payload);
}

export function validateUpdateResourceInput(payload: unknown) {
  return updateResourceSchema.parse(payload);
}

// ==================== FEATURE 3: VOLUNTEER REVIEWS ====================

const interactionContextSchema = z.enum([
  "RESCUE_OPERATION",
  "MEDICAL_AID",
  "SUPPLY_DISTRIBUTION",
  "SHELTER_MANAGEMENT",
  "OTHER"
]);

export const createReviewSchema = z.object({
  volunteerId: z.string().min(1, "Volunteer ID is required"),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  text: z.string().min(20, "Review text must be at least 20 characters").max(2000, "Review text is too long"),
  interactionContext: interactionContextSchema,
  interactionDate: z.string().refine((date) => {
    const interactionDate = new Date(date);
    const today = new Date();
    return interactionDate <= today;
  }, "Interaction date cannot be in the future"),
  wouldWorkAgain: z.boolean(),
  crisisEventId: z.string().optional().nullable()
});

// ==================== FEATURE 4: SECURE DOCUMENTATION ====================

export const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(80, "Folder name must be at most 80 characters"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  crisisId: z.string().optional()
});

export const addNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(2000, "Note must be at most 2000 characters"),
  lat: z.number().optional(),
  lng: z.number().optional()
});

export const shareFolderSchema = z.object({
  expiresInHours: z.enum(["1", "24", "168", "0"]).optional()
});

export function validateDashboardFeedQuery(raw: unknown) {
  const schema = z.object({
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radiusKm: z.coerce.number().min(1).max(100).default(10),
    incidentType: z.enum(["ALL", "FLOOD", "FIRE", "EARTHQUAKE", "BUILDING_COLLAPSE", "ROAD_ACCIDENT", "VIOLENCE", "MEDICAL_EMERGENCY", "OTHER"]).optional(),
    severity: z.enum(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
    timeRangeHours: z.coerce.number().min(0).max(168).optional(),
    sortBy: z.enum(["mostRecent", "highestSeverity", "mostReports"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional()
  });

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      radiusKm: 10,
      incidentType: "ALL" as const,
      severity: "ALL" as const,
      timeRangeHours: undefined,
      sortBy: "mostRecent" as const,
      sortOrder: "desc" as const
    };
  }

  return {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radiusKm: parsed.data.radiusKm,
    incidentType: parsed.data.incidentType ?? "ALL",
    severity: parsed.data.severity ?? "ALL",
    timeRangeHours: parsed.data.timeRangeHours,
    sortBy: parsed.data.sortBy ?? "mostRecent",
    sortOrder: parsed.data.sortOrder ?? "desc"
  };
}

export function validateIncidentId(id: string): string {
  if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new Error("Invalid incident ID format");
  }
  return id;
}
