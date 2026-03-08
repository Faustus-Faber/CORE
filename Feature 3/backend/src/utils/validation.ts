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

export const createReviewSchema = z.object({
  volunteerId: z.string().min(1, "Volunteer ID is required"),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  text: z.string().min(20, "Review text must be at least 20 characters").max(2000, "Review text is too long"),
  interactionContext: z.enum(["RESCUE_OPERATION", "MEDICAL_AID", "SUPPLY_DISTRIBUTION", "SHELTER_MANAGEMENT", "OTHER"]),
  interactionDate: z.string().refine((date) => {
    const interactionDate = new Date(date);
    const today = new Date();
    return interactionDate <= today;
  }, "Interaction date cannot be in the future"),
  wouldWorkAgain: z.boolean(),
  crisisEventId: z.string().optional().nullable()
});
