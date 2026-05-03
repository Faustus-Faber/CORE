import { useEffect, useState } from "react";

import {
  approveReservationApi,
  declineReservationApi,
  deactivateResource as deactivateResourceApi,
  deleteResource as deleteResourceApi,
  getMyResources,
  getReservationsForResource,
  getResourceHistory,
  type ResourceDetail,
  type ResourceHistoryEntry,
  type ResourceReservation,
  updateResource
} from "../services/api";

type EditForm = {
  name: string;
  quantity: number;
  notes: string;
  status: string;
};

export default function MyResourcesPage() {
  const [resources, setResources] = useState<ResourceDetail[]>([]);
  const [reservationsMap, setReservationsMap] = useState<Record<string, ResourceReservation[]>>({});
  const [editingResource, setEditingResource] = useState<ResourceDetail | null>(null);
  const [historyEntries, setHistoryEntries] = useState<ResourceHistoryEntry[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    quantity: 1,
    notes: "",
    status: "Available"
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});

  useEffect(() => {
    void refreshResources();
  }, []);

  async function refreshResources() {
    try {
      const data = await getMyResources();
      setResources(data);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
    }
  }

  function openEditModal(resource: ResourceDetail) {
    setEditingResource(resource);
    setEditForm({
      name: resource.name,
      quantity: resource.quantity,
      notes: resource.notes || "",
      status: resource.status
    });
    setShowEditModal(true);
  }

  async function loadReservations(resourceId: string) {
    try {
      const data = await getReservationsForResource(resourceId);
      setReservationsMap((current) => ({
        ...current,
        [resourceId]: data
      }));
    } catch (error) {
      console.error("Failed to load reservations", error);
    }
  }

  async function loadHistory(resourceId: string) {
    try {
      const data = await getResourceHistory(resourceId);
      setHistoryEntries(data);
      setShowHistoryModal(true);
    } catch (error) {
      console.error("Failed to load history", error);
    }
  }

  async function handleApprove(reservationId: string, resourceId: string) {
    try {
      await approveReservationApi(reservationId);
      await Promise.all([loadReservations(resourceId), refreshResources()]);
    } catch (error: any) {
      alert(error.message || "Unable to approve the reservation");
    }
  }

  async function handleDecline(reservationId: string, resourceId: string) {
    try {
      await declineReservationApi(reservationId, declineReason[reservationId]?.trim() || undefined);
      setDeclineReason((current) => ({
        ...current,
        [reservationId]: ""
      }));
      await Promise.all([loadReservations(resourceId), refreshResources()]);
    } catch (error: any) {
      alert(error.message || "Unable to decline the reservation");
    }
  }

  async function handleSaveEdit() {
    if (!editingResource) {
      return;
    }

    try {
      const result = await updateResource(editingResource.id, editForm);
      setResources((current) =>
        current.map((resource) =>
          resource.id === editingResource.id ? { ...resource, ...result.resource } : resource
        )
      );
      setShowEditModal(false);
      setEditingResource(null);
      await loadHistory(editingResource.id);
    } catch (error: any) {
      alert(error.message || "Unable to update the resource");
    }
  }

  async function handleDeactivate(resourceId: string) {
    try {
      await deactivateResourceApi(resourceId);
      await refreshResources();
    } catch (error: any) {
      alert(error.message || "Unable to deactivate the resource");
    }
  }

  async function handleDelete(resourceId: string) {
    if (!confirm("Are you sure you want to delete this resource?")) {
      return;
    }

    try {
      await deleteResourceApi(resourceId);
      setResources((current) => current.filter((resource) => resource.id !== resourceId));
    } catch (error: any) {
      alert(error.message || "Unable to delete the resource");
    }
  }

  if (resources.length === 0) {
    return <p className="mt-10 text-center text-gray-500">No resources registered yet.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-3 sm:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-7">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">My Resources</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage stock, review incoming reservation requests, and keep your resource feed accurate for nearby users.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {resources.map((resource) => (
          <article
            key={resource.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{resource.name}</h2>
                <p className="text-sm text-slate-500">{resource.category}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  resource.status === "Available"
                    ? "bg-emerald-100 text-emerald-700"
                    : resource.status === "Low Stock"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-200 text-slate-700"
                }`}
              >
                {resource.status}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Quantity:</span> {resource.quantity} {resource.unit}
              </p>
              <p>
                <span className="font-semibold">Address:</span> {resource.address}
              </p>
              <p>
                <span className="font-semibold">Coordinates:</span> {resource.latitude.toFixed(6)}, {resource.longitude.toFixed(6)}
              </p>
              <p>
                <span className="font-semibold">Contact:</span> {resource.contactPreference}
              </p>
              {resource.notes ? (
                <p>
                  <span className="font-semibold">Notes:</span> {resource.notes}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                onClick={() => openEditModal(resource)}
              >
                Edit
              </button>
              {resource.status !== "Unavailable" ? (
                <button
                  type="button"
                  className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                  onClick={() => handleDeactivate(resource.id)}
                >
                  Deactivate
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                onClick={() => handleDelete(resource.id)}
              >
                Delete
              </button>
              <button
                type="button"
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                onClick={() => loadHistory(resource.id)}
              >
                Update History
              </button>
              <button
                type="button"
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                onClick={() => loadReservations(resource.id)}
              >
                View Reservations
              </button>
            </div>

            {reservationsMap[resource.id] ? (
              <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                {reservationsMap[resource.id].length === 0 ? (
                  <p className="text-sm text-slate-500">No reservations yet.</p>
                ) : (
                  reservationsMap[resource.id].map((reservation) => (
                    <div key={reservation.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {reservation.user?.fullName ?? "Requester"} requested {reservation.quantity}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{reservation.justification}</p>
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p>Status: {reservation.status}</p>
                        <p>Requested at: {new Date(reservation.createdAt).toLocaleString()}</p>
                        {reservation.pickupTime ? (
                          <p>Pickup time: {new Date(reservation.pickupTime).toLocaleString()}</p>
                        ) : null}
                        {reservation.decisionReason ? <p>Decision note: {reservation.decisionReason}</p> : null}
                      </div>

                      {reservation.status === "Pending" ? (
                        <div className="mt-4 space-y-3">
                          <input
                            type="text"
                            value={declineReason[reservation.id] ?? ""}
                            onChange={(event) =>
                              setDeclineReason((current) => ({
                                ...current,
                                [reservation.id]: event.target.value
                              }))
                            }
                            placeholder="Optional decline note"
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="flex-1 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                              onClick={() => handleApprove(reservation.id, resource.id)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="flex-1 rounded-2xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                              onClick={() => handleDecline(reservation.id, resource.id)}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : null}

            <p className="mt-4 text-xs text-slate-400">
              Created at: {new Date(resource.createdAt).toLocaleString()}
            </p>
          </article>
        ))}
      </div>

      {showEditModal && editingResource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-6 sm:px-4">
          <div className="max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
            <h2 className="text-2xl font-bold text-slate-900">Edit Resource</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Resource Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Remaining Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(event) =>
                    setEditForm({ ...editForm, quantity: Math.max(0, Number(event.target.value) || 0) })
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                  min={0}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Status</label>
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="Available">Available</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Depleted">Depleted</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                  className="min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showHistoryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-6 sm:px-4">
          <div className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
              <h2 className="text-2xl font-bold text-slate-900">Update History</h2>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
              {historyEntries.length === 0 ? <p className="text-sm text-slate-500">No history found.</p> : null}
              {historyEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">Status:</span> {entry.oldStatus} to {entry.newStatus}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold">Quantity:</span> {entry.oldQuantity} to {entry.newQuantity}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-4 py-5 sm:px-6">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-full rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
