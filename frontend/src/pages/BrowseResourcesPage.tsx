import { useEffect, useState } from "react";
import { getAllResources, type ResourceSummary } from "../services/api";

export default function BrowseResourcesPage() {
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [selectedResource, setSelectedResource] = useState<ResourceSummary | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justification, setJustification] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  useEffect(() => {
    getAllResources()
      .then(setResources)
      .catch((err) => console.error("Failed to load resources", err));
  }, []);

  const handleReserve = async () => {
    if (!selectedResource) return;

    try {
      const res = await fetch("http://localhost:5000/api/resources/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          resourceId: selectedResource.id,
          quantity,
          justification,
          pickupTime: pickupTime || null
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      alert("Reservation submitted!");
      setSelectedResource(null);
      setQuantity(1);
      setJustification("");
      setPickupTime("");
    } catch (err: any) {
      alert(err.message || "Reservation failed");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Browse Resources</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {resources.map((r) => (
          <div key={r.id} className="border p-4 rounded shadow">
            <h2 className="text-lg font-bold">{r.name}</h2>

            <p><b>Category:</b> {r.category}</p>
            <p><b>Quantity:</b> {r.quantity} {r.unit}</p>
            <p><b>Status:</b> {r.status}</p>
            <p><b>Address:</b> {r.address}</p>

            <button
              className="mt-2 bg-blue-500 text-white px-3 py-1 rounded"
              disabled={!["Available", "Low Stock"].includes(r.status)}
              onClick={() => setSelectedResource(r)}
            >
              Reserve
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Reserve: {selectedResource.name}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, Math.floor(selectedResource.quantity * 0.3))}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="border p-2 w-full rounded"
                />
                <p className="text-xs text-gray-500">
                  Max allowed: {Math.max(1, Math.floor(selectedResource.quantity * 0.3))}
                </p>
              </div>

              <div>
                <label className="block font-semibold">Reason</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="border p-2 w-full rounded"
                />
              </div>

              <div>
                <label className="block font-semibold">Pickup Time</label>
                <input
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="border p-2 w-full rounded"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleReserve}
                  className="bg-green-600 text-white px-4 py-2 rounded w-full"
                >
                  Submit
                </button>

                <button
                  onClick={() => setSelectedResource(null)}
                  className="bg-gray-400 text-white px-4 py-2 rounded w-full"
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