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

// Resource validation schemas
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

export function validateRegistrationInput(payload: unknown) {
  return registrationSchema.parse(payload);
}
