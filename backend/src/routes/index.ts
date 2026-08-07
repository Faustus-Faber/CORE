import { Router } from "express";

import { adminRoutes } from "./adminRoutes.js";
import { authRoutes } from "./authRoutes.js";
import { claimsRoutes } from "./claimsRoutes.js";
import { crisisUpdateRoutes } from "./crisisUpdateRoutes.js";
import { crisisChatRoutes } from "./crisisChatRoutes.js";
import { assignmentRoutes } from "./assignmentRoutes.js";
import { briefRoutes } from "./briefRoutes.js";
import { copilotRoutes } from "./copilotRoutes.js";
import { dashboardRoutes } from "./dashboardRoutes.js";
import { healthRoutes } from "./healthRoutes.js";
import { metricsRoutes } from "./metricsRoutes.js";
import { needRoutes } from "./needRoutes.js";
import { notificationRoutes } from "./notificationRoutes.js";
import { profileRoutes } from "./profileRoutes.js";
import { reportRoutes } from "./reportRoutes.js";
import { reviewRoutes } from "./reviewRoutes.js";
import { volunteerRoutes } from "./volunteerRoutes.js";
import { resourceRoutes } from "./resourceRoutes.js";

import { evidenceRoutes } from "./evidenceRoutes.js";
import { timesheetRoutes } from "./timesheetRoutes.js";
import { ngoReportRoutes } from "./ngoReportRoutes.js";
import { ocrRoutes } from "./ocrRoutes.js";
import { fulfillmentRoutes } from "./fulfillmentRoutes.js";
import { workspaceRoutes } from "./workspaceRoutes.js";
import { exportRoutes } from "./exportRoutes.js";
import { ffwcRoutes } from "./ffwcRoutes.js";
import { responderApprovalRoutes } from "./responderApprovalRoutes.js";
import { pushRoutes } from "./pushRoutes.js";
import { vouchRoutes } from "./vouchRoutes.js";

export const apiRoutes = Router();

// §15.2: Health endpoints — liveness vs readiness
apiRoutes.use("/health", healthRoutes);

// §15.4: Metrics endpoint — operational observability
apiRoutes.use("/metrics", metricsRoutes);

// ── Existing routes (backward compatible) ──────────────────────────────────
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/profile", profileRoutes);
apiRoutes.use("/admin", adminRoutes);
apiRoutes.use("/reports", reportRoutes);
apiRoutes.use("/reviews", reviewRoutes);
apiRoutes.use("/volunteers", volunteerRoutes);
apiRoutes.use("/resources", resourceRoutes);

apiRoutes.use("/evidence", evidenceRoutes);
apiRoutes.use("/ngo-reports", ngoReportRoutes);
apiRoutes.use("/ocr", ocrRoutes);
apiRoutes.use("/dashboard", dashboardRoutes);
apiRoutes.use("/crises", crisisUpdateRoutes);
apiRoutes.use("/crises", crisisChatRoutes);   // crisis-scoped chat
apiRoutes.use("/notifications", notificationRoutes);
apiRoutes.use("/timesheet", timesheetRoutes);
// TRACK B
apiRoutes.use("/claims", claimsRoutes);
apiRoutes.use("/crises", assignmentRoutes);  // assignments under crisis
apiRoutes.use("/needs", needRoutes);          // needs at /needs
apiRoutes.use("/briefs", briefRoutes);
apiRoutes.use("/copilot", copilotRoutes);
// TRACK C
apiRoutes.use("/", fulfillmentRoutes);
apiRoutes.use("/", workspaceRoutes);
// §15.5: Interoperability exports (GeoJSON, CSV)
apiRoutes.use("/exports", exportRoutes);

// §15.5/§19: FFWC flood forecasting adapter
apiRoutes.use("/ffwc", ffwcRoutes);

// FR-01: Responder approval workflow (admin-only)
apiRoutes.use("/admin", responderApprovalRoutes);

// §19: Web Push subscription management
apiRoutes.use("/push", pushRoutes);

// Trust tier system: vouching
apiRoutes.use("/vouch", vouchRoutes);

// ── Versioned routes (/api/v1) ─────────────────────────────────────────────
const v1Routes = Router();

v1Routes.use("/health", healthRoutes);
v1Routes.use("/metrics", metricsRoutes);

v1Routes.use("/auth", authRoutes);
v1Routes.use("/profile", profileRoutes);
v1Routes.use("/admin", adminRoutes);
v1Routes.use("/admin", responderApprovalRoutes);
v1Routes.use("/reports", reportRoutes);
v1Routes.use("/reviews", reviewRoutes);
v1Routes.use("/volunteers", volunteerRoutes);
v1Routes.use("/resources", resourceRoutes);

v1Routes.use("/evidence", evidenceRoutes);
v1Routes.use("/ngo-reports", ngoReportRoutes);
v1Routes.use("/ocr", ocrRoutes);
v1Routes.use("/dashboard", dashboardRoutes);
v1Routes.use("/crises", crisisUpdateRoutes);
v1Routes.use("/crises", crisisChatRoutes);
v1Routes.use("/notifications", notificationRoutes);
v1Routes.use("/timesheet", timesheetRoutes);
v1Routes.use("/claims", claimsRoutes);
v1Routes.use("/crises", assignmentRoutes);
v1Routes.use("/needs", needRoutes);
v1Routes.use("/briefs", briefRoutes);
v1Routes.use("/copilot", copilotRoutes);
v1Routes.use("/", fulfillmentRoutes);
v1Routes.use("/", workspaceRoutes);
v1Routes.use("/exports", exportRoutes);
v1Routes.use("/ffwc", ffwcRoutes);
v1Routes.use("/vouch", vouchRoutes);

apiRoutes.use("/v1", v1Routes);
