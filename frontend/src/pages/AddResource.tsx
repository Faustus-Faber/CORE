import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LocationPicker from "../components/LocationPicker";
import { addResource } from "../services/api";

interface ResourceForm {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  condition: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  availabilityStart: string;
  availabilityEnd: string;
  contactPreference: string;
  notes: string;
}

export default function AddResourcePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ResourceForm>({
    name: "",
    category: "Medical Supplies",
    quantity: 1,
    unit: "pieces",
    condition: "New",
    address: "",
    latitude: null,
    longitude: null,
    availabilityStart: "",
    availabilityEnd: "",
    contactPreference: "Phone",
    notes: "",
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revoke object URLs when preview changes or component unmounts
  useEffect(() => {
    return () => {
      preview.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [preview]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const allFiles = Array.from(e.target.files);
    const validFiles = allFiles.filter((f) => f.size <= MAX_FILE_SIZE);
    const selectedFiles = validFiles.slice(0, 3);
    setPhotos(selectedFiles);

    const previewUrls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreview(previewUrls);
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (form.latitude == null || form.longitude == null) {
      alert("Please select the pickup location on the map.");
      setIsSubmitting(false);
      return;
    }

    try {
      await addResource({
        name: form.name,
        category: form.category,
        quantity: form.quantity,
        unit: form.unit,
        condition: form.condition,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        availabilityStart: form.availabilityStart,
        availabilityEnd: form.availabilityEnd,
        contactPreference: form.contactPreference,
        notes: form.notes || undefined,
        photos: photos
      });
      alert("Resource registered successfully!");
      navigate("/resources/my");
    } catch (err: any) {
      alert("Error adding resource: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ── 1. Header Card Box (Matching Report Incident) ────────────────────── */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
        <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
          Register a Resource
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Register supplies, equipment, or emergency relief assets for crisis response teams.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Section 1: Resource Details Card ─────────────────────────────── */}
        <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Resource Details
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="resource-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resource Name *
              </label>
              <input
                id="resource-name"
                type="text"
                name="name"
                maxLength={100}
                required
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Clean Drinking Water 5L"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
              />
            </div>

            <div>
              <label htmlFor="resource-category" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Category *
              </label>
              <select
                id="resource-category"
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
              >
                <option>Medical Supplies</option>
                <option>Food & Water</option>
                <option>Shelter</option>
                <option>Clothing</option>
                <option>Transportation</option>
                <option>Tools & Equipment</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="resource-quantity" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Quantity *
              </label>
              <input
                id="resource-quantity"
                type="number"
                name="quantity"
                min={1}
                required
                value={form.quantity}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
              />
            </div>

            <div>
              <label htmlFor="resource-unit" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Unit *
              </label>
              <select
                id="resource-unit"
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
              >
                <option>pieces</option>
                <option>packs</option>
                <option>liters</option>
                <option>kg</option>
                <option>units</option>
                <option>seats</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="resource-condition" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Condition *
              </label>
              <select
                id="resource-condition"
                name="condition"
                value={form.condition}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
              >
                <option>New</option>
                <option>Good</option>
                <option>Fair</option>
              </select>
            </div>
          </div>
        </section>

        {/* ── Section 2: Location & Pickup Card ────────────────────────────── */}
        <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Location & Pickup
          </h2>

          <div>
            <label htmlFor="pickup-address" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pickup Address *
            </label>
            <input
              id="pickup-address"
              type="text"
              name="address"
              required
              value={form.address}
              onChange={handleChange}
              placeholder="e.g. House 42, Road 11, Mirpur-10, Dhaka"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pin Pickup Location on Map *
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Pin the resource location on the map or search for an address. GPS auto-detect available.
            </p>

            <div className="rounded-lg overflow-hidden border border-slate-200 shadow-xs">
              <LocationPicker onLocationSelect={handleLocationSelect} />
            </div>

            {form.latitude != null && form.longitude != null && (
              <p className="mt-2 text-xs font-semibold text-tide flex items-center gap-1">
                <span>📍</span>
                <span>Selected Location: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</span>
              </p>
            )}
          </div>
        </section>

        {/* ── Section 3: Availability & Contact Card ───────────────────────── */}
        <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Availability & Contact
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="availability-start" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Available From
              </label>
              <input
                id="availability-start"
                type="datetime-local"
                name="availabilityStart"
                value={form.availabilityStart}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
              />
            </div>

            <div>
              <label htmlFor="availability-end" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Available Until
              </label>
              <input
                id="availability-end"
                type="datetime-local"
                name="availabilityEnd"
                value={form.availabilityEnd}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-preference" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contact Preference *
            </label>
            <select
              id="contact-preference"
              name="contactPreference"
              value={form.contactPreference}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
            >
              <option>Phone</option>
              <option>SMS</option>
              <option>In-App</option>
            </select>
          </div>

          <div>
            <label htmlFor="resource-photos" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Resource Photos (max 3)
            </label>
            <input
              id="resource-photos"
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-tide focus:ring-1 focus:ring-tide"
            />

            {preview.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {preview.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Resource Preview ${i + 1}`}
                    className="h-24 w-24 object-cover rounded-lg border border-slate-200 shadow-xs"
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="additional-notes" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Additional Notes (optional)
            </label>
            <textarea
              id="additional-notes"
              name="notes"
              maxLength={500}
              rows={3}
              value={form.notes}
              onChange={handleChange}
              placeholder="e.g. Pickup instructions, handling requirements..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-tide focus:ring-1 focus:ring-tide"
            />
          </div>
        </section>

        {/* ── Submit Action Bar ───────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-tide px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-tide/90 disabled:opacity-50"
          >
            {isSubmitting ? "Registering..." : "Register Resource"}
          </button>
        </div>

      </form>
    </div>
  );
}
