import { useEffect, useState } from "react";
import { getMyResources, updateResource, deactivateResource as deactivateResourceApi, deleteResource as deleteResourceApi } from "../services/api";

interface Resource {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  createdAt: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPreference: string;
  notes?: string;
  photos?: string[];
  condition?: string;
}

interface EditForm {
  name: string;
  quantity: number;
  notes: string;
  status: string;
}

export default function MyResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    quantity: 1,
    notes: "",
    status: "Available"
  });
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    getMyResources()
      .then((data) => setResources(data))
      .catch((err) => console.error("Failed to fetch resources:", err));
  }, []);

  const handleEditClick = (resource: Resource) => {
    setEditingResource(resource);
    setEditForm({
      name: resource.name,
      quantity: resource.quantity,
      notes: resource.notes || "",
      status: resource.status
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingResource) return;

    try {
      const data = await updateResource(editingResource.id, editForm);
      setResources((prev) =>
        prev.map((r) =>
          r.id === editingResource.id ? { ...r, ...data.resource } : r
        )
      );
      setShowEditModal(false);
      setEditingResource(null);
      alert("Resource updated successfully!");
    } catch (err: any) {
      alert("Error updating resource: " + (err.message || "Unknown error"));
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateResourceApi(id);
      setResources(resources.map(r => r.id === id ? { ...r, status: "Unavailable" } : r));
      alert("Resource deactivated!");
    } catch (err: any) {
      alert("Error deactivating resource: " + (err.message || "Unknown error"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;

    try {
      await deleteResourceApi(id);
      setResources(resources.filter(r => r.id !== id));
      alert("Resource deleted successfully!");
    } catch (err: any) {
      alert("Error deleting resource: " + (err.message || "Unknown error"));
    }
  };

  if (!resources.length) {
    return <p className="text-center mt-10 text-gray-500">No resources registered yet.</p>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="grid gap-6 md:grid-cols-2">
        {resources.map(r => (
          <div key={r.id} className="bg-white shadow rounded-lg p-4 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold">{r.name}</h2>
              <span
                className={`px-2 py-1 rounded-full text-sm font-semibold ${
                  r.status === "Available"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {r.status}
              </span>
            </div>

            <p className="text-gray-700">
              <span className="font-semibold">Category:</span> {r.category}
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Quantity:</span> {r.quantity} {r.unit}
            </p>

            {r.availabilityStart && r.availabilityEnd && (
              <p className="text-gray-700">
                <span className="font-semibold">Available:</span>{" "}
                {new Date(r.availabilityStart).toLocaleString()} -{" "}
                {new Date(r.availabilityEnd).toLocaleString()}
              </p>
            )}

            <p className="text-gray-700">
              <span className="font-semibold">Address:</span> {r.address}
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Coordinates:</span>{" "}
              {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
            </p>

            <p className="text-gray-700">
              <span className="font-semibold">Contact:</span> {r.contactPreference}
            </p>

            {r.notes && (
              <p className="text-gray-700">
                <span className="font-semibold">Notes:</span> {r.notes}
              </p>
            )}

            {r.photos && r.photos.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {r.photos.map((photo, i) => {
                  const photoUrl = photo.startsWith("http")
                    ? photo
                    : `${import.meta.env.VITE_API_URL?.replace("/api", "")}/${photo}`;
                  return (
                    <img
                      key={i}
                      src={photoUrl}
                      alt={`Resource ${r.name} ${i + 1}`}
                      className="h-24 w-24 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://via.placeholder.com/96?text=No+Image";
                      }}
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded"
                onClick={() => handleEditClick(r)}
              >
                Edit
              </button>
              {r.status === "Available" && (
                <button
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1 rounded"
                  onClick={() => handleDeactivate(r.id)}
                >
                  Deactivate
                </button>
              )}
              <button
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded"
                onClick={() => handleDelete(r.id)}
              >
                Delete
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              Created at: {new Date(r.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {showEditModal && editingResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Edit Resource</h2>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Resource Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="border rounded p-2 w-full"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                  className="border rounded p-2 w-full"
                  min={1}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="border rounded p-2 w-full"
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="border rounded p-2 w-full"
                >
                  <option value="Available">Available</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Depleted">Depleted</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
