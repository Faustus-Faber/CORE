import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import { AdminPanelPage } from "./pages/AdminPanelPage";
import { AdminReportModerationPage } from "./pages/AdminReportModerationPage";
import AddResource from "./pages/AddResource";
import { DashboardPage } from "./pages/DashboardPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { FolderDetailsPage } from "./pages/FolderDetailsPage"; // Feature 4
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import { MyDocumentsPage } from "./pages/MyDocumentsPage"; // Feature 4
import MyResourcesPage from "./pages/MyResourcesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ReportIncidentPage } from "./pages/ReportIncidentPage";
import { ReportsExplorerPage } from "./pages/ReportsExplorerPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { VolunteerDirectoryPage } from "./pages/VolunteerDirectoryPage";
import { VolunteerProfilePage } from "./pages/VolunteerProfilePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/report-incident" element={<ReportIncidentPage />} />
          <Route path="/reports/explore" element={<ReportsExplorerPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/resources" element={<Navigate to="/resources/add" replace />} />
          <Route path="/resources/add" element={<AddResource />} />
          <Route path="/resources/my" element={<MyResourcesPage />} />
          <Route path="/volunteers" element={<VolunteerDirectoryPage />} />
          <Route path="/volunteers/:volunteerId" element={<VolunteerProfilePage />} />
          
          {/* Feature 4: Secure Documentation Routes */}
          <Route path="/docs" element={<MyDocumentsPage />} />
          <Route path="/docs/:folderId" element={<FolderDetailsPage />} />
          
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
                  description="NGO summary report generation is admin-only."
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
