import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";

import { getAllResources, getMapReports, type MapIncident, type ResourceSummary } from "../services/api";
import { coloredIcon, SEVERITY_COLORS, RESOURCE_COLORS } from "./LeafletMap";

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

// ── Recenter helper ──────────────────────────────────────────────
function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// ── Custom Zoom Controls (Bottom Right) ─────────────────────────
function CustomZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-1.5 shadow-md">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-base font-bold text-slate-700 backdrop-blur transition hover:bg-slate-100 hover:text-ink shadow-xs"
        title="Zoom In"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-base font-bold text-slate-700 backdrop-blur transition hover:bg-slate-100 hover:text-ink shadow-xs"
        title="Zoom Out"
      >
        −
      </button>
    </div>
  );
}

export default function ResourceMap() {
  const navigate = useNavigate();

  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [incidents, setIncidents] = useState<MapIncident[]>([]);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState("all");
  const [controlsOpen, setControlsOpen] = useState(true);
  const [center, setCenter] = useState<[number, number]>([23.685, 90.356]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const resourceCategories = Array.from(new Set(resources.map((resource) => resource.category))).sort();

  useEffect(() => {
    const refreshMapData = async () => {
      try {
        const [nextResources, nextIncidents] = await Promise.all([getAllResources(), getMapReports()]);
        setResources(Array.isArray(nextResources) ? nextResources : []);
        setIncidents(
          (Array.isArray(nextIncidents) ? nextIncidents : []).map((incident) => ({
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
        setCenter([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        console.error("Location error:", error);
      }
    );
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data && data.length > 0) {
          setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  };

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

  const getIncidentColor = (severity: string) => SEVERITY_COLORS[severity] ?? "#22c55e";

  const getResourceColor = (resource: ResourceSummary) => {
    if (resource.status === "Depleted" || resource.status === "Unavailable") {
      return "#94a3b8";
    }
    return RESOURCE_COLORS[resource.category] ?? RESOURCE_COLORS.default;
  };

  return (
    <div className="relative h-full w-full">
      
      {/* ── Top Bar & Controls Drawer Overlay (Top Left) ─────────────────── */}
      <div className="absolute top-4 left-4 z-[1000] w-72 space-y-3">
        {/* Search & Toggle Bar */}
        <div className="rounded-xl border border-slate-200 bg-white/95 p-2 shadow-md backdrop-blur flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex min-w-0 flex-1 gap-1">
            <input
              type="text"
              placeholder="Search location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-tide"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-tide px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-tide/90 disabled:opacity-50"
            >
              {searching ? "..." : "Go"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setControlsOpen((open) => !open)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              controlsOpen
                ? "border-tide/60 bg-tide/10 text-tide"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
            title="Toggle Filter Panel"
          >
            Filters
          </button>
        </div>

        {/* Expandable Map Filters Panel */}
        {controlsOpen && (
          <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-y-auto rounded-xl border border-slate-200/90 bg-white/95 p-4 shadow-lg backdrop-blur animate-fade-in">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-ink font-display">Map Controls</h2>
              <p className="text-xs text-slate-500">Track live incidents & relief resources.</p>
            </div>

            <div className="grid gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100">
              <label className="flex items-center gap-2 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResources}
                  onChange={() => setShowResources((current) => !current)}
                  className="rounded text-tide focus:ring-tide"
                />
                <span>Resources ({visibleResources.length})</span>
              </label>
              <label className="flex items-center gap-2 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIncidents}
                  onChange={() => setShowIncidents((current) => !current)}
                  className="rounded text-tide focus:ring-tide"
                />
                <span>Incidents ({visibleIncidents.length})</span>
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Severity</label>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-tide"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Incident Type</label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-tide"
              >
                <option value="all">All Types</option>
                {INCIDENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Resource Category</label>
              <select
                value={resourceCategoryFilter}
                onChange={(event) => setResourceCategoryFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-tide"
              >
                <option value="all">All Categories</option>
                {resourceCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Leaflet Map Container with CartoDB Voyager Tiles ─────────────── */}
      <MapContainer
        center={center}
        zoom={7}
        zoomControl={false}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Recenter center={center} zoom={7} />
        <CustomZoomControls />

        {showResources &&
          visibleResources.map((resource) => (
            <Marker
              key={resource.id}
              position={[Number(resource.latitude), Number(resource.longitude)]}
              icon={coloredIcon(getResourceColor(resource))}
            >
              <Popup>
                <div className="max-w-xs space-y-2 p-1">
                  <h3 className="text-sm font-bold text-ink font-display">{resource.name}</h3>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Category:</span> {resource.category}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Quantity:</span> {resource.quantity} {resource.unit}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    <span className="font-semibold text-slate-800">Address:</span> {resource.address}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Status:</span> {resource.status}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/browse-resources?resourceId=${resource.id}`)}
                    className="w-full mt-2 rounded-lg bg-tide px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-tide/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!["Available", "Low Stock"].includes(resource.status)}
                  >
                    Reserve Resource
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

        {showIncidents &&
          visibleIncidents.map((incident) => (
            <Marker
              key={incident.id}
              position={[Number(incident.latitude), Number(incident.longitude)]}
              icon={coloredIcon(getIncidentColor(incident.severity))}
            >
              <Popup>
                <div className="max-w-xs space-y-2 p-1">
                  <h3 className="text-sm font-bold text-ink font-display">{incident.title}</h3>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Type:</span> {incident.type.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Severity:</span> {incident.severity}
                  </p>
                  {incident.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{incident.description}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/incidents/${incident.id}`)}
                    className="w-full mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
