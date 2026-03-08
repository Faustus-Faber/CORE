import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import { AdminPanelPage } from "./pages/AdminPanelPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProfilePage } from "./pages/ProfilePage";
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
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/map"
            element={
              <PlaceholderPage
                title="Interactive Crisis Map"
                description="Module 2 map view placeholder. Route is secured by authentication."
              />
            }
          />
          <Route
            path="/resources"
            element={
              <PlaceholderPage
                title="Resource Hub"
                description="Resource registration and reservation routes are protected."
              />
            }
          />
          <Route path="/volunteers" element={<VolunteerDirectoryPage />} />
          <Route path="/volunteers/:volunteerId" element={<VolunteerProfilePage />} />
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
              path="/reports"
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
