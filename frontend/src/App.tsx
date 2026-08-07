import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import { AdminPanelPage } from "./pages/AdminPanelPage";
import { AdminReportModerationPage } from "./pages/AdminReportModerationPage";
import AddResource from "./pages/AddResource";
import { DashboardPage } from "./pages/DashboardPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { SharedFolderPage } from "./pages/SharedFolderPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import MyResourcesPage from "./pages/MyResourcesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { NotificationPreferencesPage } from "./pages/NotificationPreferencesPage";
import { NotificationInbox } from "./pages/NotificationInbox";
import { ReportIncidentPage } from "./pages/ReportIncidentPage";
import { ReportsExplorerPage } from "./pages/ReportsExplorerPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { EvidenceGalleryPage } from "./pages/EvidenceGalleryPage";
import { VolunteerDirectoryPage } from "./pages/VolunteerDirectoryPage";
import { VolunteerProfilePage } from "./pages/VolunteerProfilePage";
import BrowseResourcesPage from "./pages/BrowseResourcesPage";
import { MyTimesheetPage } from "./pages/MyTimesheetPage";
import { OperationsWorkspacePage } from "./pages/OperationsWorkspacePage";
import { ResponsePlanPage } from "./pages/ResponsePlanPage";
import { AfterActionReportPage } from "./pages/AfterActionReportPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/shared/:token" element={<SharedFolderPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/dashboard/incidents/:id" element={<ErrorBoundary><IncidentDetailPage /></ErrorBoundary>} />
          <Route path="/report-incident" element={<ErrorBoundary><ReportIncidentPage /></ErrorBoundary>} />
          <Route path="/reports/explore" element={<ErrorBoundary><ReportsExplorerPage /></ErrorBoundary>} />
          <Route path="/reports/:id" element={<ErrorBoundary><ReportDetailPage /></ErrorBoundary>} />
          <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
          <Route path="/map" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
          <Route path="/gallery" element={<ErrorBoundary><EvidenceGalleryPage /></ErrorBoundary>} />
          <Route path="/resources" element={<Navigate to="/resources/add" replace />} />
          <Route path="/resources/add" element={<ErrorBoundary><AddResource /></ErrorBoundary>} />
          <Route path="/resources/my" element={<ErrorBoundary><MyResourcesPage /></ErrorBoundary>} />
          <Route path="/browse-resources" element={<ErrorBoundary><BrowseResourcesPage /></ErrorBoundary>} />
          <Route path="/volunteers" element={<ErrorBoundary><VolunteerDirectoryPage /></ErrorBoundary>} />
          <Route path="/volunteers/:volunteerId" element={<ErrorBoundary><VolunteerProfilePage /></ErrorBoundary>} />
          <Route path="/leaderboard" element={<ErrorBoundary><LeaderboardPage /></ErrorBoundary>} />

          <Route path="/notifications" element={<ErrorBoundary><NotificationInbox /></ErrorBoundary>} />
          <Route path="/notifications/preferences" element={<ErrorBoundary><NotificationPreferencesPage /></ErrorBoundary>} />

          <Route element={<RoleRoute allowedRoles={["VOLUNTEER"]} />}>
            <Route
              path="/tasks"
              element={<ErrorBoundary><MyTimesheetPage /></ErrorBoundary>}
            />
          </Route>

          <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin" element={<ErrorBoundary><AdminPanelPage /></ErrorBoundary>} />
            <Route
              path="/reports/review"
              element={<Navigate to="/verification-queue" replace />}
            />
            <Route
              path="/reports"
              element={<Navigate to="/verification-queue" replace />}
            />
            <Route path="/reports/generate" element={<Navigate to="/after-action-reports" replace />} />
            <Route path="/ngo-reports/archive" element={<Navigate to="/after-action-reports" replace />} />
          </Route>

          <Route path="/operations" element={<ErrorBoundary><OperationsWorkspacePage /></ErrorBoundary>} />
          <Route path="/operations/:crisisId" element={<ErrorBoundary><OperationsWorkspacePage /></ErrorBoundary>} />
          <Route path="/crises/:crisisId/response-plan" element={<ErrorBoundary><ResponsePlanPage /></ErrorBoundary>} />
          <Route path="/verification-queue" element={<ErrorBoundary><AdminReportModerationPage /></ErrorBoundary>} />
          <Route path="/after-action-reports" element={<ErrorBoundary><AfterActionReportPage /></ErrorBoundary>} />
          <Route path="/after-action-reports/:crisisId" element={<ErrorBoundary><AfterActionReportPage /></ErrorBoundary>} />
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
