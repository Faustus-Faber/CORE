import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

export function RoleRoute({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="py-20 text-center text-slate-600">Checking session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
