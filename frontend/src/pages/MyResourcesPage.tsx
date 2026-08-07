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
import { normalizeMediaUrl } from "../utils/incident";

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

  // Photo Gallery Lightbox State
  const [activeGalleryPhotos, setActiveGalleryPhotos] = useState<string[] | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    quantity: 1,
    notes: "",
    status: "Available"
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});
  const [fetchError, setFetchError] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  useEffect(() => {
    void refreshResources();
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    if (!showEditModal && !showHistoryModal && !activeGalleryPhotos) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowEditModal(false);
        setShowHistoryModal(false);
        setActiveGalleryPhotos(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showEditModal, showHistoryModal, activeGalleryPhotos]);

  async function refreshResources() {
    try {
      setFetchError("");
      const data = await getMyResources();
      setResources(data);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
      setFetchError("Failed to load resources. Please try again.");
    }
  }

  function openGallery(photos: string[], initialIndex = 0) {
    setActiveGalleryPhotos(photos);
    setActivePhotoIdx(initialIndex);
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
    const actionKey = `approve-${reservationId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    try {
      await approveReservationApi(reservationId);
      await Promise.all([loadReservations(resourceId), refreshResources()]);
    } catch (error: any) {
      alert(error.message || "Unable to approve the reservation");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDecline(reservationId: string, resourceId: string) {
    const actionKey = `decline-${reservationId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    try {
      await declineReservationApi(reservationId, declineReason[reservationId]?.trim() || undefined);
      setDeclineReason((current) => ({
        ...current,
        [reservationId]: ""
      }));
      await Promise.all([loadReservations(resourceId), refreshResources()]);
    } catch (error: any) {
      alert(error.message || "Unable to decline the reservation");
    } finally {
      setPendingAction("");
    }
  }

  async function handleSaveEdit() {
    if (!editingResource) {
      return;
    }

    const actionKey = `save-${editingResource.id}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
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
    } finally {
      setPendingAction("");
    }
  }

  async function handleDeactivate(resourceId: string) {
    const actionKey = `deactivate-${resourceId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    try {
      await deactivateResourceApi(resourceId);
      await refreshResources();
    } catch (error: any) {
      alert(error.message || "Unable to deactivate the resource");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDelete(resourceId: string) {
    if (!confirm("Are you sure you want to delete this resource?")) {
      return;
    }

    const actionKey = `delete-${resourceId}`;
    if (pendingAction) return;
    setPendingAction(actionKey);
    try {
      await deleteResourceApi(resourceId);
      setResources((current) => current.filter((resource) => resource.id !== resourceId));
    } catch (error: any) {
      alert(error.message || "Unable to delete the resource");
    } finally {
      setPendingAction("");
    }
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <p className="mt-10 text-center text-red-600 text-sm font-medium">{fetchError}</p>
        <div className="text-center">
          <button onClick={() => void refreshResources()} className="mt-2 text-xs font-semibold text-tide hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Signature Header Card Box */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
        <h1 className="text-2xl font-bold tracking-tight text-ink font-display">My Resources</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage stock, review incoming reservation requests, and keep your resource feed accurate for nearby users.
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-12 text-center shadow-panel ring-1 ring-[#0e7490]/20">
          <p className="text-sm font-medium text-slate-500">No resources registered yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {resources.map((resource) => {
            const hasPhotos = resource.photos && resource.photos.length > 0;

            return (
              <article
                key={resource.id}
                className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-bold text-ink font-display truncate">{resource.name}</h2>
                      <p className="text-xs text-slate-500">{resource.category}</p>
                    </div>

                    {/* Photo Thumbnail */}
                    {hasPhotos ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          openGallery(resource.photos!);
                        }}
                        className="relative h-14 w-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 shadow-xs group/img transition hover:opacity-90"
                        title="Click to view photo gallery"
                      >
                        <img
                          src={normalizeMediaUrl(resource.photos![0])}
                          alt={resource.name}
                          className="h-full w-full object-cover transition duration-300 group-hover/img:scale-110"
                        />
                        {resource.photos!.length > 1 && (
                          <span className="absolute bottom-1 right-1 rounded-md bg-slate-950/80 px-1 py-0.2 text-[9px] font-bold text-white backdrop-blur-xs">
                            +{resource.photos!.length - 1}
                          </span>
                        )}
                      </div>
                    ) : null}

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border flex-shrink-0 ${
                        resource.status === "Available"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : resource.status === "Low Stock"
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                    >
                      {resource.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">Quantity:</span> {resource.quantity} {resource.unit}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold text-slate-900">Address:</span> {resource.address}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Coordinates:</span> {resource.latitude?.toFixed(6) ?? "N/A"}, {resource.longitude?.toFixed(6) ?? "N/A"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Contact:</span> {resource.contactPreference}
                    </p>
                    {resource.notes ? (
                      <p className="line-clamp-2">
                        <span className="font-semibold text-slate-900">Notes:</span> {resource.notes}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      className="rounded-lg bg-tide px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-tide/90"
                      onClick={() => openEditModal(resource)}
                    >
                      Edit
                    </button>
                    {resource.status !== "Unavailable" ? (
                      <button
                        type="button"
                        disabled={!!pendingAction}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600"
                        onClick={() => handleDeactivate(resource.id)}
                      >
                        Deactivate
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={!!pendingAction}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                      onClick={() => handleDelete(resource.id)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      onClick={() => loadHistory(resource.id)}
                    >
                      History
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      onClick={() => loadReservations(resource.id)}
                    >
                      Reservations
                    </button>
                  </div>

                  {reservationsMap[resource.id] ? (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                      {(reservationsMap[resource.id]?.length ?? 0) === 0 ? (
                        <p className="text-xs text-slate-500">No reservations yet.</p>
                      ) : (
                        reservationsMap[resource.id]?.map((reservation) => (
                          <div key={reservation.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                            <p className="font-semibold text-ink">
                              {reservation.user?.fullName ?? "Requester"} requested {reservation.quantity}
                            </p>
                            <p className="mt-1 text-slate-600">{reservation.justification}</p>
                            <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                              <p>Status: {reservation.status}</p>
                              <p>Requested at: {new Date(reservation.createdAt).toLocaleString()}</p>
                            </div>

                            {reservation.status === "Pending" ? (
                              <div className="mt-3 space-y-2">
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
                                  className="w-full rounded-md border border-slate-300 px-2.5 py-1 text-xs"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={!!pendingAction}
                                    className="flex-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                    onClick={() => handleApprove(reservation.id, resource.id)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!!pendingAction}
                                    className="flex-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
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

                  <p className="mt-3 text-[10px] text-slate-400">
                    Registered: {new Date(resource.createdAt).toLocaleString()}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Sleek Glassmorphism Photo Lightbox Modal */}
      {activeGalleryPhotos && activeGalleryPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 sm:p-6 backdrop-blur-sm animate-fade-in"
          onClick={() => setActiveGalleryPhotos(null)}
        >
          <div
            className="max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#0e7490]/30 bg-white p-5 shadow-2xl ring-1 ring-[#0e7490]/20 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-tide">Resource Photo Gallery</p>
                <p className="text-sm font-semibold text-ink">Photo {activePhotoIdx + 1} of {activeGalleryPhotos.length}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveGalleryPhotos(null)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close ✕
              </button>
            </div>

            {/* Photo Container */}
            <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl p-3 min-h-[300px]">
              <img
                src={normalizeMediaUrl(activeGalleryPhotos[activePhotoIdx])}
                alt={`Photo ${activePhotoIdx + 1}`}
                className="max-h-[55vh] max-w-full rounded-lg object-contain shadow-md"
              />
            </div>

            {/* Thumbnails Row */}
            {activeGalleryPhotos.length > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100">
                {activeGalleryPhotos.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition ${
                      activePhotoIdx === idx
                        ? "border-tide scale-105 shadow-md"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={normalizeMediaUrl(src)} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Resource Modal */}
      {showEditModal && editingResource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-6 sm:px-4 backdrop-blur-xs">
          <div className="max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-2xl ring-1 ring-[#0e7490]/20">
            <h2 className="text-xl font-bold text-ink font-display">Edit Resource</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Resource Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Remaining Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(event) =>
                    setEditForm({ ...editForm, quantity: Math.max(0, Number(event.target.value) || 0) })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                  min={0}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Status</label>
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                >
                  <option value="Available">Available</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Depleted">Depleted</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                  className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={!!pendingAction}
                onClick={handleSaveEdit}
                className="flex-1 rounded-lg bg-tide px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-tide/90"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Update History Modal */}
      {showHistoryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-6 sm:px-4 backdrop-blur-xs">
          <div className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#0e7490]/30 bg-white shadow-2xl ring-1 ring-[#0e7490]/20">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-ink font-display">Update History</h2>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {historyEntries.length === 0 ? <p className="text-xs text-slate-500">No history found.</p> : null}
              {historyEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="text-slate-700">
                    <span className="font-semibold text-ink">Status:</span> {entry.oldStatus} to {entry.newStatus}
                  </p>
                  <p className="mt-1 text-slate-700">
                    <span className="font-semibold text-ink">Quantity:</span> {entry.oldQuantity} to {entry.newQuantity}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400 font-mono">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
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
