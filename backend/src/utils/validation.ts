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

export function validateReportSubmissionInput(payload: unknown) {
  return reportSubmissionSchema.parse(payload);
}

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
  order: z.enum(["asc", "desc"]).optional().default("desc")
});

export function validateReportListQueryInput(payload: unknown) {
  return reportListQuerySchema.parse(payload);
}
