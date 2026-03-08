import { useEffect, useState } from "react";

import { listUsers, updateUserBanStatus, updateUserRole } from "../services/api";

type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  role: "USER" | "VOLUNTEER" | "ADMIN";
  isBanned: boolean;
  createdAt: string;
};

export function AdminPanelPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadUsers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await listUsers();
      setUsers(response.users);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, role: "USER" | "VOLUNTEER") => {
    setMessage("");
    setError("");
    try {
      await updateUserRole(userId, role);
      setMessage("Role updated");
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update role");
    }
  };

  const handleBanToggle = async (userId: string, isBanned: boolean) => {
    setMessage("");
    setError("");
    try {
      await updateUserBanStatus(userId, isBanned);
      setMessage(isBanned ? "User banned" : "User unbanned");
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update status");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-ink">Admin Panel</h1>
      <p className="text-slate-700">
        Manage user accounts, role promotions/demotions, and ban status.
      </p>

      {message && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl bg-white shadow-panel ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading users...
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{user.fullName}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.phone}</td>
                  <td className="px-4 py-3">{user.role}</td>
                  <td className="px-4 py-3">{user.isBanned ? "Banned" : "Active"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {user.role !== "ADMIN" && (
                        <select
                          value={user.role}
                          onChange={(event) =>
                            void handleRoleChange(
                              user.id,
                              event.target.value as "USER" | "VOLUNTEER"
                            )
                          }
                          className="rounded border border-slate-300 px-2 py-1"
                        >
                          <option value="USER">User</option>
                          <option value="VOLUNTEER">Volunteer</option>
                        </select>
                      )}
                      {user.role !== "ADMIN" && (
                        <button
                          type="button"
                          onClick={() => void handleBanToggle(user.id, !user.isBanned)}
                          className={`rounded px-3 py-1 font-semibold text-white ${
                            user.isBanned ? "bg-moss" : "bg-ember"
                          }`}
                        >
                          {user.isBanned ? "Unban" : "Ban"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
