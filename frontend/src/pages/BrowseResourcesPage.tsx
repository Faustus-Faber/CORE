import { useEffect, useState, useMemo, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createReservationApi,
  getAllResources,
  type ResourceSummary
} from "../services/api";
import { normalizeMediaUrl } from "../utils/incident";

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
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Gallery Modal State
  const [activeGalleryPhotos, setActiveGalleryPhotos] = useState<string[] | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Filters state (unapplied draft vs applied)
  const [searchInput, setSearchInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("ALL");
  
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("ALL");

  useEffect(() => {
    setIsLoading(true);
    getAllResources()
      .then((data) => {
        setResources(Array.isArray(data) ? data : []);
        setFetchError("");
      })
      .catch((error) => {
        console.error("Failed to load resources", error);
        setFetchError("Failed to load resources. Please try again.");
      })
      .finally(() => setIsLoading(false));
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

  const categories = useMemo(() => {
    return Array.from(new Set(resources.map((r) => r.category))).sort();
  }, [resources]);

  const visibleResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesStatus = ["Available", "Low Stock"].includes(resource.status);
      const matchesCategory = appliedCategory === "ALL" || resource.category === appliedCategory;
      const q = appliedSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        resource.name.toLowerCase().includes(q) ||
        resource.category.toLowerCase().includes(q) ||
        resource.address.toLowerCase().includes(q);

      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [resources, appliedCategory, appliedSearch]);

  const selectedResourceCap = selectedResource ? getReservationCap(selectedResource) : 1;

  const handleApplyFilters = (e: FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    setAppliedCategory(categoryInput);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setCategoryInput("ALL");
    setAppliedSearch("");
    setAppliedCategory("ALL");
  };

  function openGallery(photos: string[], initialIndex = 0) {
    setActiveGalleryPhotos(photos);
    setActivePhotoIdx(initialIndex);
  }

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
    <div className="space-y-6">
      {/* ── 1. Signature Header Card Box ────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
        <h1 className="text-2xl font-bold tracking-tight text-ink font-display">Browse Resources</h1>
        <p className="mt-1 text-sm text-slate-600">
          Find nearby community supplies, review live availability, and submit a fair-use reservation request.
        </p>
      </div>

      {/* ── 2. Search & Filter Bar Card ───────────────────────────────────────── */}
      <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white shadow-xs"
          >
            Available Resources
          </button>
          <Link
            to="/resources/my"
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            My Resources
          </Link>
          <Link
            to="/resources/add"
            className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-ember/90 transition shadow-xs"
          >
            Register Resource
          </Link>
        </div>

        <form onSubmit={handleApplyFilters} className="mt-4 grid gap-3 md:grid-cols-4 items-end">
          <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
            Search
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Title, category, or address"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Category
            <select
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-tide/90"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {/* ── 3. Resources Grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-tide border-t-transparent"></div>
        </div>
      ) : fetchError ? (
        <div className="text-center">
          <p className="mt-10 text-red-600 text-sm font-medium">{fetchError}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              getAllResources()
                .then((data) => { setResources(data); setFetchError(""); })
                .catch(() => setFetchError("Failed to load resources. Please try again."))
                .finally(() => setIsLoading(false));
            }}
            className="mt-2 text-xs font-semibold text-tide hover:underline"
          >
            Try again
          </button>
        </div>
      ) : visibleResources.length === 0 ? (
        <div className="rounded-xl border border-[#0e7490]/30 bg-white p-12 text-center shadow-panel ring-1 ring-[#0e7490]/20">
          <p className="text-sm font-medium text-slate-500">No resources found matching your filter criteria.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleResources.map((resource) => {
            const hasPhotos = resource.photos && resource.photos.length > 0;

            return (
              <article
                key={resource.id}
                className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 transition-all hover:ring-tide/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold text-ink font-display truncate">{resource.name}</h2>
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
                        resource.status === "Low Stock"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {resource.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">Provider:</span> {resource.user?.fullName ?? "Community Contributor"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Available:</span> {resource.quantity} {resource.unit}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold text-slate-900">Pickup:</span> {resource.address}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Contact ({resource.contactPreference}):</span>{" "}
                      <span className="font-mono text-tide font-semibold">{resource.user?.phone ?? resource.user?.email ?? "Available via App"}</span>
                    </p>
                    {resource.notes ? (
                      <p className="line-clamp-2">
                        <span className="font-semibold text-slate-900">Notes:</span> {resource.notes}
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-5 w-full rounded-lg bg-tide px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-tide/90"
                  onClick={() => openResource(resource)}
                >
                  Reserve Resource
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* ── 4. Sleek Glassmorphism Photo Lightbox Modal ───────────────────────── */}
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

      {/* ── 5. Reservation Modal Popup ────────────────────────────────────────── */}
      {selectedResource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-3 py-6 sm:px-4 sm:py-8 backdrop-blur-xs">
          <div className="max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[#0e7490]/30 bg-white shadow-2xl ring-1 ring-[#0e7490]/20">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-wider text-tide">Resource Reservation</p>
              <h2 className="mt-1 text-xl font-bold text-ink font-display">{selectedResource.name}</h2>
              <p className="mt-1 text-xs text-slate-600">
                Reserve up to {selectedResourceCap} {selectedResource.unit} from this listing.
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-700 border border-slate-200 space-y-1">
                <p>
                  <span className="font-semibold text-slate-900">Provider:</span> {selectedResource.user?.fullName ?? "Community Contributor"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Direct Contact ({selectedResource.contactPreference}):</span>{" "}
                  <span className="font-mono text-tide font-bold">{selectedResource.user?.phone ?? selectedResource.user?.email ?? "Available via App"}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Category:</span> {selectedResource.category}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Current Stock:</span> {selectedResource.quantity} {selectedResource.unit}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Pickup Address:</span> {selectedResource.address}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Requested Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={selectedResourceCap}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Math.min(selectedResourceCap, Number(event.target.value) || 1)))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purpose / Justification *</label>
                  <span className={`text-[10px] font-semibold ${justification.trim().length >= 10 ? "text-emerald-600" : "text-amber-600"}`}>
                    {justification.trim().length}/10 min chars
                  </span>
                </div>
                <textarea
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                  placeholder="Describe who needs this resource and why (at least 10 characters)."
                  maxLength={300}
                />
                {justification.trim().length > 0 && justification.trim().length < 10 && (
                  <p className="mt-1 text-[11px] text-amber-600 font-medium">
                    Please enter at least 10 characters explaining your request.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Preferred Pickup Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row">
              <button
                type="button"
                onClick={handleReserve}
                disabled={
                  submitting ||
                  justification.trim().length < 10 ||
                  quantity < 1 ||
                  quantity > selectedResourceCap
                }
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? "Submitting..." : "Submit Reservation"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
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
