import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import { AdminPanelPage } from "./pages/AdminPanelPage";
import { AdminReportModerationPage } from "./pages/AdminReportModerationPage";
import { NGOReportsArchivePage } from "./pages/NGOReportsArchivePage";
import AddResource from "./pages/AddResource";
import { DashboardPage } from "./pages/DashboardPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { FolderDetailsPage } from "./pages/FolderDetailsPage";
import { SharedFolderPage } from "./pages/SharedFolderPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import { MyDocumentsPage } from "./pages/MyDocumentsPage";
import MyResourcesPage from "./pages/MyResourcesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/report-incident" element={<ReportIncidentPage />} />
          <Route path="/reports/explore" element={<ReportsExplorerPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/gallery" element={<EvidenceGalleryPage />} />
          <Route path="/resources" element={<Navigate to="/resources/add" replace />} />
          <Route path="/resources/add" element={<AddResource />} />
          <Route path="/resources/my" element={<MyResourcesPage />} />
          <Route path="/browse-resources" element={<BrowseResourcesPage />} />
          <Route path="/volunteers" element={<VolunteerDirectoryPage />} />
          <Route path="/volunteers/:volunteerId" element={<VolunteerProfilePage />} />
          
          {/* Feature 4: Secure Documentation Routes */}
          <Route path="/docs" element={<MyDocumentsPage />} />
          <Route path="/docs/:folderId" element={<FolderDetailsPage />} />

          <Route path="/notifications" element={<NotificationInbox />} />
          <Route path="/notifications/preferences" element={<NotificationPreferencesPage />} />

          <Route
            path="/leaderboard"
            element={
              <PlaceholderPage
                title="Leaderboard"
                description="Gamification leaderboard is available to authenticated users."
              />
            }
          />

          <Route element={<RoleRoute allowedRoles={["VOLUNTEER"]} />}>
            <Route
              path="/tasks"
              element={
                <PlaceholderPage
                  title="My Tasks"
                  description="Volunteer task log and dispatch tools are volunteer-only."
                />
              }
            />
          </Route>

          <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin" element={<AdminPanelPage />} />
            <Route path="/admin/ngo-reports" element={<NGOReportsArchivePage />} />
            <Route
              path="/reports/review"
              element={<AdminReportModerationPage />}
            />
            <Route
              path="/reports"
              element={<Navigate to="/reports/review" replace />}
            />
            <Route
              path="/reports/generate"
              element={
                <PlaceholderPage
                  title="Generate Reports"
                  description="NGO summary reports are generated from the detail page of a Resolved or Closed crisis event."
                />
              }
            />
          </Route>
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
