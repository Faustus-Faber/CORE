import { useEffect, useState } from "react";
import { Autocomplete, GoogleMap, InfoWindow, Marker, MarkerClusterer, useLoadScript } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";

import { getAllResources, getMapReports, type MapIncident, type ResourceSummary } from "../services/api";

const MAP_LIBRARIES = ["places"] as never[];
const INCIDENT_TYPE_OPTIONS = [
  "FLOOD",
  "FIRE",
  "EARTHQUAKE",
  "BUILDING_COLLAPSE",
  "ROAD_ACCIDENT",
  "VIOLENCE",
  "MEDICAL_EMERGENCY",
  "OTHER"
] as const;

export default function ResourceMap() {
  const navigate = useNavigate();
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES
  });

  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [incidents, setIncidents] = useState<MapIncident[]>([]);
  const [selectedResource, setSelectedResource] = useState<ResourceSummary | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<MapIncident | null>(null);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState("all");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [center, setCenter] = useState({
    lat: 23.685,
    lng: 90.356
  });

  const resourceCategories = Array.from(new Set(resources.map((resource) => resource.category))).sort();

  useEffect(() => {
    const refreshMapData = async () => {
      try {
        const [nextResources, nextIncidents] = await Promise.all([getAllResources(), getMapReports()]);
        setResources(nextResources);
        setIncidents(
          nextIncidents.map((incident) => ({
            ...incident,
            severity: incident.severity.toUpperCase()
          }))
        );
      } catch (error) {
        console.error("Failed to refresh map data:", error);
      }
    };

    void refreshMapData();
    const intervalId = window.setInterval(() => {
      void refreshMapData();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error("Location error:", error);
      }
    );
  }, []);

  if (!isLoaded) {
    return <div>Loading Map...</div>;
  }

  const visibleResources = resources.filter((resource) => {
    const latitude = Number(resource.latitude);
    const longitude = Number(resource.longitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return false;
    }

    if (resourceCategoryFilter !== "all" && resource.category !== resourceCategoryFilter) {
      return false;
    }

    return true;
  });

  const visibleIncidents = incidents.filter((incident) => {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return false;
    }

    if (severityFilter !== "all" && incident.severity !== severityFilter) {
      return false;
    }

    if (typeFilter !== "all" && incident.type !== typeFilter) {
      return false;
    }

    return true;
  });

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

  const getResourceIcon = (resource: ResourceSummary) => {
    if (resource.status === "Depleted" || resource.status === "Unavailable") {
      return "http://maps.google.com/mapfiles/ms/icons/grey-dot.png";
    }

    if (resource.category === "Medical Supplies") {
      return "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";
    }

    if (resource.category === "Food & Water") {
      return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
    }

    if (resource.category === "Shelter") {
      return "http://maps.google.com/mapfiles/ms/icons/purple-dot.png";
    }

    return "http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png";
  };

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[50] space-y-2 sm:inset-x-auto sm:left-3 sm:flex sm:w-auto sm:items-start sm:gap-3 sm:space-y-0">
        <div className="pointer-events-auto flex w-full gap-2 sm:order-2 sm:w-80 lg:w-72">
          <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
            <Autocomplete
              onLoad={(instance) => setAutocomplete(instance)}
              onPlaceChanged={() => {
                if (!autocomplete) {
                  return;
                }

                const place = autocomplete.getPlace();
                const location = place.geometry?.location;

                if (!location) {
                  return;
                }

                setCenter({
                  lat: location.lat(),
                  lng: location.lng()
                });
              }}
            >
              <input
                type="text"
                placeholder="Search location..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </Autocomplete>
          </div>

          <button
            type="button"
            onClick={() => setControlsOpen((open) => !open)}
            className="rounded-2xl border border-slate-200 bg-white/95 px-3 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:bg-slate-50 sm:hidden"
            aria-expanded={controlsOpen}
          >
            Filters
          </button>
        </div>

        <div
          className={`pointer-events-auto max-h-[58dvh] w-full space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:order-1 sm:block sm:max-h-[calc(100dvh-10rem)] sm:w-72 sm:p-4 ${
            controlsOpen ? "block" : "hidden"
          }`}
        >
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Map Controls</h2>
            <p className="text-xs text-slate-600 sm:text-sm">Track live incidents and reserve nearby relief resources.</p>
          </div>

          <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showResources}
                onChange={() => setShowResources((current) => !current)}
              />
              Resources
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showIncidents}
                onChange={() => setShowIncidents((current) => !current)}
              />
              Incidents
            </label>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Incident Severity</p>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Incident Type</p>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All incident types</option>
              {INCIDENT_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Resource Category</p>
            <select
              value={resourceCategoryFilter}
              onChange={(event) => setResourceCategoryFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All resource categories</option>
              {resourceCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={7}
        options={{ disableDefaultUI: false }}
      >
        <MarkerClusterer options={{ gridSize: 60 }}>
          {(clusterer) => (
            <>
              {showResources &&
                visibleResources.map((resource) => (
                  <Marker
                    key={resource.id}
                    position={{
                      lat: Number(resource.latitude),
                      lng: Number(resource.longitude)
                    }}
                    title={resource.name}
                    icon={getResourceIcon(resource)}
                    clusterer={clusterer}
                    onClick={() => setSelectedResource(resource)}
                  />
                ))}

              {showIncidents &&
                visibleIncidents.map((incident) => (
                  <Marker
                    key={incident.id}
                    position={{
                      lat: Number(incident.latitude),
                      lng: Number(incident.longitude)
                    }}
                    title={incident.title}
                    icon={getIncidentIcon(incident.severity)}
                    clusterer={clusterer}
                    onClick={() => setSelectedIncident(incident)}
                  />
                ))}
            </>
          )}
        </MarkerClusterer>

        {selectedResource && (
          <InfoWindow
            position={{
              lat: Number(selectedResource.latitude),
              lng: Number(selectedResource.longitude)
            }}
            onCloseClick={() => setSelectedResource(null)}
          >
            <div className="max-w-xs space-y-2 p-2">
              <h3 className="text-lg font-bold text-slate-900">{selectedResource.name}</h3>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Category:</span> {selectedResource.category}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Quantity:</span> {selectedResource.quantity} {selectedResource.unit}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Address:</span> {selectedResource.address}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Contact:</span> {selectedResource.contactPreference}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Status:</span> {selectedResource.status}
              </p>
              {selectedResource.notes ? (
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Notes:</span> {selectedResource.notes}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => navigate(`/browse-resources?resourceId=${selectedResource.id}`)}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!["Available", "Low Stock"].includes(selectedResource.status)}
              >
                Reserve
              </button>
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
            <div className="max-w-xs space-y-2 p-2">
              <h3 className="text-lg font-bold text-slate-900">{selectedIncident.title}</h3>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Type:</span> {selectedIncident.type.replaceAll("_", " ")}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Severity:</span> {selectedIncident.severity}
              </p>
              {selectedIncident.description ? (
                <p className="text-sm text-slate-600">{selectedIncident.description}</p>
              ) : null}
              <button
                type="button"
                onClick={() => navigate(`/dashboard/incidents/${selectedIncident.id}`)}
                className="w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                View Details
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
