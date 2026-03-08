import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LocationPicker from "../components/LocationPicker";

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files).slice(0, 3);
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

    if (!form.latitude || !form.longitude) {
      alert("Please select the pickup location on the map.");
      return;
    }

    const data = new FormData();

    Object.entries(form).forEach(([key, value]) =>
      data.append(key, value?.toString() || "")
    );

    photos.forEach((file) => data.append("photos", file));

    const token = localStorage.getItem("token");

    const res = await fetch("http://localhost:5000/api/resources/add", {
      method: "POST",
      body: data,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      alert("Resource added successfully!");
      navigate("/resources/my");
    } else {
      const err = await res.json();
      alert("Error adding resource: " + err.error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-xl rounded-xl">
      <h1 className="text-2xl font-bold mb-6">Register a Resource</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div>
          <label className="block font-semibold">Resource Name *</label>
          <input
            type="text"
            name="name"
            maxLength={100}
            required
            value={form.name}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          />
        </div>

        <div>
          <label className="block font-semibold">Category *</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="border rounded p-2 w-full"
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

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-semibold">Quantity *</label>
            <input
              type="number"
              name="quantity"
              min={1}
              required
              value={form.quantity}
              onChange={handleChange}
              className="border rounded p-2 w-full"
            />
          </div>

          <div className="flex-1">
            <label className="block font-semibold">Unit *</label>
            <select
              name="unit"
              value={form.unit}
              onChange={handleChange}
              className="border rounded p-2 w-full"
            >
              <option>pieces</option>
              <option>packs</option>
              <option>liters</option>
              <option>kg</option>
              <option>units</option>
              <option>seats</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold">Condition *</label>
          <select
            name="condition"
            value={form.condition}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          >
            <option>New</option>
            <option>Good</option>
            <option>Fair</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold">Pickup Address *</label>
          <input
            type="text"
            name="address"
            required
            value={form.address}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">
            Select Pickup Location *
          </label>

          <div className="rounded overflow-hidden border">
            <LocationPicker onLocationSelect={handleLocationSelect} />
          </div>

          {form.latitude && form.longitude && (
            <p className="text-sm text-gray-600 mt-2">
              📍 Selected Coordinates: {form.latitude.toFixed(6)},{" "}
              {form.longitude.toFixed(6)}
            </p>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-semibold">Start Date/Time</label>
            <input
              type="datetime-local"
              name="availabilityStart"
              value={form.availabilityStart}
              onChange={handleChange}
              className="border rounded p-2 w-full"
            />
          </div>

          <div className="flex-1">
            <label className="block font-semibold">End Date/Time</label>
            <input
              type="datetime-local"
              name="availabilityEnd"
              value={form.availabilityEnd}
              onChange={handleChange}
              className="border rounded p-2 w-full"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold">Contact Preference *</label>
          <select
            name="contactPreference"
            value={form.contactPreference}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          >
            <option>Phone</option>
            <option>SMS</option>
            <option>In-App</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold">Photos (max 3)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            className="border rounded p-2 w-full"
          />

          {preview.length > 0 && (
            <div className="flex gap-3 mt-3">
              {preview.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  className="w-24 h-24 object-cover rounded border"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block font-semibold">Additional Notes</label>
          <textarea
            name="notes"
            maxLength={500}
            value={form.notes}
            onChange={handleChange}
            className="border rounded p-2 w-full"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Add Resource
        </button>
      </form>
    </div>
  );
}
