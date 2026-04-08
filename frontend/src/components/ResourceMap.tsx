import { useEffect, useState } from "react";
import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";

interface Resource {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  quantity: number;
  unit: string;
  address: string;
  contactPreference: string;
}

export default function ResourceMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/resources/all")
      .then((res) => res.json())
      .then((data) => setResources(data))
      .catch((err) => console.error("Failed to fetch resources:", err));
  }, []);

  if (!isLoaded) return <div>Loading Map...</div>;

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "500px" }}
      center={{ lat: 23.685, lng: 90.356 }}
      zoom={7}
    >
      {resources.map((r) => (
        <Marker
          key={r.id}
          position={{ lat: r.latitude, lng: r.longitude }}
          title={r.name}
          onClick={() => setSelectedResource(r)}
        />
      ))}

      {selectedResource && (
        <InfoWindow
          position={{
            lat: selectedResource.latitude,
            lng: selectedResource.longitude
          }}
          onCloseClick={() => setSelectedResource(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-lg mb-2">{selectedResource.name}</h3>
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-semibold">Category:</span> {selectedResource.category}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-semibold">Quantity:</span> {selectedResource.quantity}{" "}
              {selectedResource.unit}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-semibold">Address:</span> {selectedResource.address}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">Contact:</span> {selectedResource.contactPreference}
            </p>
            <a
              href={`/resources/reserve/${selectedResource.id}`}
              className="block text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-semibold"
            >
              Reserve
            </a>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
