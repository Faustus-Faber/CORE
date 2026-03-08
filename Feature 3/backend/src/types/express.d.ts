import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
        role: Role;
      };
    }
  }
}

export {};
