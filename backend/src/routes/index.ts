import { Router } from "express";

import { adminRoutes } from "./adminRoutes.js";
import { authRoutes } from "./authRoutes.js";
import { profileRoutes } from "./profileRoutes.js";
import { resourceRoutes } from "./resourceRoutes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/profile", profileRoutes);
apiRoutes.use("/admin", adminRoutes);
apiRoutes.use("/resources", resourceRoutes);