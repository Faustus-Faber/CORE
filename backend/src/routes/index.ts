import { Router } from "express";

import { adminRoutes } from "./adminRoutes.js";
import { authRoutes } from "./authRoutes.js";
import { crisisUpdateRoutes } from "./crisisUpdateRoutes.js";
import { dashboardRoutes } from "./dashboardRoutes.js";
import { ngoReportRoutes } from "./ngoReportRoutes.js";
import { notificationRoutes } from "./notificationRoutes.js";
import { profileRoutes } from "./profileRoutes.js";
import { reportRoutes } from "./reportRoutes.js";
import { reviewRoutes } from "./reviewRoutes.js";
import { volunteerRoutes } from "./volunteerRoutes.js";
import { resourceRoutes } from "./resourceRoutes.js";
import { docRoutes } from "./docRoutes.js";
import { evidenceRoutes } from "./evidenceRoutes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/profile", profileRoutes);
apiRoutes.use("/admin", adminRoutes);
apiRoutes.use("/reports", reportRoutes);
apiRoutes.use("/reviews", reviewRoutes);
apiRoutes.use("/volunteers", volunteerRoutes);
apiRoutes.use("/resources", resourceRoutes);
apiRoutes.use("/docs", docRoutes);
apiRoutes.use("/evidence", evidenceRoutes);
apiRoutes.use("/dashboard", dashboardRoutes);
apiRoutes.use("/crises", crisisUpdateRoutes);
apiRoutes.use("/ngo-reports", ngoReportRoutes);
apiRoutes.use("/notifications", notificationRoutes);