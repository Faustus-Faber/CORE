import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createReservationApi,
  getAllResources,
  type ResourceSummary
} from "../services/api";

function getReservationCap(resource: ResourceSummary) {
  return Math.max(1, Math.floor(resource.quantity * 0.3));
}

export default function BrowseResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [selectedResource, setSelectedResource] = useState<ResourceSummary | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justification, setJustification] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAllResources()
      .then((data) => setResources(data))
      .catch((error) => console.error("Failed to load resources", error));
  }, []);

  useEffect(() => {
    const resourceId = searchParams.get("resourceId");
    if (!resourceId || resources.length === 0) {
      return;
    }

    const matchedResource = resources.find((resource) => resource.id === resourceId) ?? null;
    if (!matchedResource) {
      return;
    }

    setSelectedResource(matchedResource);
    setQuantity(1);
  }, [resources, searchParams]);

  const visibleResources = resources.filter((resource) => ["Available", "Low Stock"].includes(resource.status));

  const selectedResourceCap = selectedResource ? getReservationCap(selectedResource) : 1;

  async function handleReserve() {
    if (!selectedResource || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await createReservationApi({
        resourceId: selectedResource.id,
        quantity,
        justification,
        pickupTime: pickupTime || null
      });

      alert("Reservation submitted successfully.");
      closeModal();
      const nextResources = await getAllResources();
      setResources(nextResources);
    } catch (error: any) {
      alert(error.message || "Reservation failed");
    } finally {
      setSubmitting(false);
    }
  }

  function openResource(resource: ResourceSummary) {
    setSelectedResource(resource);
    setQuantity(1);
    setJustification("");
    setPickupTime("");
    setSearchParams({ resourceId: resource.id });
  }

  function closeModal() {
    setSelectedResource(null);
    setQuantity(1);
    setJustification("");
    setPickupTime("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("resourceId");
    setSearchParams(nextParams);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-3 sm:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-7">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Browse Resources</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Find nearby community supplies, review live availability, and submit a fair-use reservation request.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleResources.map((resource) => (
          <article
            key={resource.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{resource.name}</h2>
                <p className="text-sm text-slate-500">{resource.category}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  resource.status === "Low Stock"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {resource.status}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Available:</span> {resource.quantity} {resource.unit}
              </p>
              <p>
                <span className="font-semibold">Pickup:</span> {resource.address}
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

            <button
              type="button"
              className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              onClick={() => openResource(resource)}
            >
              Reserve
            </button>
          </article>
        ))}
      </div>

      {selectedResource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-6 sm:px-4 sm:py-8">
          <div className="max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-4 py-5 sm:px-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Resource Reservation</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{selectedResource.name}</h2>
              <p className="mt-2 text-sm text-slate-600">
                Reserve up to {selectedResourceCap} {selectedResource.unit} from this listing.
              </p>
            </div>

            <div className="space-y-4 px-4 py-5 sm:px-6">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Category:</span> {selectedResource.category}
                </p>
                <p>
                  <span className="font-semibold">Current Stock:</span> {selectedResource.quantity} {selectedResource.unit}
                </p>
                <p>
                  <span className="font-semibold">Pickup Address:</span> {selectedResource.address}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Requested Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={selectedResourceCap}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Math.min(selectedResourceCap, Number(event.target.value) || 1)))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Purpose / Justification</label>
                <textarea
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                  placeholder="Describe who needs this resource and why."
                  maxLength={300}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Preferred Pickup Time</label>
                <input
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-5 sm:flex-row sm:px-6">
              <button
                type="button"
                onClick={handleReserve}
                disabled={
                  submitting ||
                  justification.trim().length < 10 ||
                  quantity < 1 ||
                  quantity > selectedResourceCap
                }
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? "Submitting..." : "Submit Reservation"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
