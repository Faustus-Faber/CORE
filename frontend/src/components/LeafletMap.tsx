import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Fix default marker icons (Leaflet's CSS image paths break under bundlers) ──
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

// ── Colored pin factory ──────────────────────────────────────────
const coloredIcon = (color: string) =>
  L.divIcon({
    className: "custom-leaflet-marker",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

export const RESOURCE_COLORS: Record<string, string> = {
  "Medical Supplies": "#3b82f6",
  "Food & Water": "#22c55e",
  Shelter: "#a855f7",
  "Tools & Equipment": "#06b6d4",
  Clothing: "#ec4899",
  Transportation: "#f59e0b",
  default: "#64748b",
};

// ── Types ────────────────────────────────────────────────────────
export interface MapPoint {
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  popupHtml?: string;
}

interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  points?: MapPoint[];
  height?: string;
  className?: string;
  interactive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  fitBounds?: boolean;
}

// ── Helper: recenter map when center prop changes ────────────────
function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, map, zoom]);
  return null;
}

// ── Helper: fit bounds to all points ─────────────────────────────
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

// ── Click handler ────────────────────────────────────────────────
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Main map component ───────────────────────────────────────────
export function LeafletMap({
  center,
  zoom = 13,
  points = [],
  height = "100%",
  className = "",
  interactive = true,
  onMapClick,
  fitBounds = false,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={className} style={{ height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {!fitBounds && <Recenter center={center} zoom={zoom} />}
        {fitBounds && <FitBounds points={points} />}
        {points.map((p, i) => (
          <Marker
            key={`${p.lat}-${p.lng}-${i}`}
            position={[p.lat, p.lng]}
            icon={p.color ? coloredIcon(p.color) : defaultIcon}
          >
            {p.popupHtml && (
              <Popup>
                <div dangerouslySetInnerHTML={{ __html: p.popupHtml }} />
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// ── Draggable single-marker picker ───────────────────────────────
interface LeafletPickerProps {
  center: [number, number];
  marker: [number, number] | null;
  height?: string;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerDrag: (lat: number, lng: number) => void;
}

function DraggableMarker({
  position,
  onDrag,
}: {
  position: [number, number];
  onDrag: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const map = useMapEvents({
    click(e) {
      onDrag(e.latlng.lat, e.latlng.lng);
    },
  });
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current?.getLatLng();
        if (ll) onDrag(ll.lat, ll.lng);
      });
    }
  }, [onDrag]);
  // keep map in scope
  void map;
  return (
    <Marker
      ref={markerRef as any}
      position={position}
      draggable
      icon={coloredIcon("#0891b2")}
    />
  );
}

export function LeafletPicker({
  center,
  marker,
  height = "320px",
  onMapClick,
  onMarkerDrag,
}: LeafletPickerProps) {
  return (
    <div style={{ height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {marker && (
          <DraggableMarker position={marker} onDrag={onMarkerDrag} />
        )}
        <Recenter center={center} zoom={13} />
      </MapContainer>
    </div>
  );
}

export { coloredIcon, defaultIcon };
export default LeafletMap;
