import { useEffect, useState } from "react";
import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { MarkerClusterer } from "@react-google-maps/api";
import { Autocomplete } from "@react-google-maps/api";
import { getAllResources, getMapReports } from "../services/api";

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

interface Incident {
  id: string;
  title: string;
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  latitude: number;
  longitude: number;
  description?: string;
  createdAt?: string;
}

const MAP_LIBRARIES = ["places"] as never[];

export default function ResourceMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES
  });

  const [resources, setResources] = useState<Resource[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [center, setCenter] = useState({
    lat: 23.685,
    lng: 90.356
  });

  useEffect(() => {
    getAllResources()
      .then((data) => setResources(data))
      .catch((err) => console.error("Failed to fetch resources:", err));
  }, []);

  useEffect(() => {
    const fetchIncidents = () => {
      getMapReports()
        .then((data) => {
          const reports = (data ?? []).map((r) => ({
            ...r,
            severity: r.severity.toUpperCase() as Incident["severity"]
          }));
          setIncidents(reports);
        })
        .catch((err) => console.error("Failed to fetch incidents:", err));
    };

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        console.error("Location error:", err);
      }
    );
  }, []);

  const validResources = resources.filter(
    (r) => !isNaN(Number(r.latitude)) && !isNaN(Number(r.longitude))
  );

  const avgCenter =
    validResources.length > 0
      ? {
          lat:
            validResources.reduce((sum, r) => sum + Number(r.latitude), 0) /
            validResources.length,
          lng:
            validResources.reduce((sum, r) => sum + Number(r.longitude), 0) /
            validResources.length
        }
      : { lat: 23.685, lng: 90.356 };

  if (!isLoaded) return <div>Loading Map...</div>;

  const getIncidentIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
      case "HIGH":
        return "http://maps.google.com/mapfiles/ms/icons/orange-dot.png";
      case "MEDIUM":
        return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
      default:
        return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
    }
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-3 left-3 z-[50] bg-white p-4 rounded-xl shadow-lg w-64 space-y-3">
        <h2 className="font-bold text-lg">Map Controls</h2>

        <div>
          <label className="block">
            <input
              type="checkbox"
              checked={showResources}
              onChange={() => setShowResources(!showResources)}
            />{" "}
            Resources
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={() => setShowIncidents(!showIncidents)}
            />{" "}
            Incidents
          </label>
        </div>

        <div>
          <p className="text-sm font-semibold">Severity</p>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full border rounded p-1"
          >
            <option value="all">All</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div>
          <p className="text-sm font-semibold">Type</p>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full border rounded p-1"
          >
            <option value="all">All</option>
            <option value="FIRE">Fire</option>
            <option value="FLOOD">Flood</option>
            <option value="MEDICAL">Medical</option>
          </select>
        </div>
      </div>

      <div className="absolute top-3 left-72 z-[50] bg-white p-2 rounded shadow">
        <Autocomplete
          onLoad={(auto) => setAutocomplete(auto)}
          onPlaceChanged={() => {
            if (!autocomplete) return;
            const place = autocomplete.getPlace();
            const loc = place.geometry?.location;
            if (!loc) return;
            setCenter({
              lat: loc.lat(),
              lng: loc.lng()
            });
          }}
        >
          <input
            type="text"
            placeholder="Search location..."
            className="w-64 p-2 border rounded"
          />
        </Autocomplete>
      </div>

      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={7}
        options={{
          disableDefaultUI: false
        }}
      >
        <MarkerClusterer options={{ gridSize: 60 }}>
          {(clusterer) => (
            <>
              {showResources &&
                resources.map((r) => {
                  const lat = Number(r.latitude);
                  const lng = Number(r.longitude);
                  if (isNaN(lat) || isNaN(lng)) return null;

                  return (
                    <Marker
                      key={r.id}
                      position={{ lat, lng }}
                      title={r.name}
                      clusterer={clusterer}
                      onClick={() => setSelectedResource(r)}
                    />
                  );
                })}

              {showIncidents &&
                Array.isArray(incidents) &&
                incidents
                  .filter((i) => {
                    if (severityFilter !== "all" && i.severity !== severityFilter)
                      return false;
                    if (typeFilter !== "all" && i.type !== typeFilter) return false;
                    return true;
                  })
                  .map((i) => {
                    const lat = Number(i.latitude);
                    const lng = Number(i.longitude);
                    if (isNaN(lat) || isNaN(lng)) return null;

                    return (
                      <Marker
                        key={i.id}
                        position={{ lat, lng }}
                        title={i.title}
                        icon={getIncidentIcon(i.severity)}
                        clusterer={clusterer}
                        onClick={() => setSelectedIncident(i)}
                      />
                    );
                  })}
            </>
          )}
        </MarkerClusterer>

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
                <span className="font-semibold">Category:</span>{" "}
                {selectedResource.category}
              </p>
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-semibold">Quantity:</span>{" "}
                {selectedResource.quantity} {selectedResource.unit}
              </p>
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-semibold">Address:</span>{" "}
                {selectedResource.address}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-semibold">Contact:</span>{" "}
                {selectedResource.contactPreference}
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

        {selectedIncident && (
          <InfoWindow
            position={{
              lat: Number(selectedIncident.latitude),
              lng: Number(selectedIncident.longitude)
            }}
            onCloseClick={() => setSelectedIncident(null)}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-bold text-lg">{selectedIncident.title}</h3>

              <p className="text-sm">
                <b>Type:</b> {selectedIncident.type}
              </p>

              <p className="text-sm">
                <b>Severity:</b> {selectedIncident.severity}
              </p>

              {selectedIncident.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedIncident.description}
                </p>
              )}

              <a
                href={`/incidents/${selectedIncident.id}`}
                className="block mt-2 text-center bg-red-600 text-white px-3 py-1 rounded"
              >
                View Details
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
