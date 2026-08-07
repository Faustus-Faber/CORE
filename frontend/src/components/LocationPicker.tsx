import { useCallback, useState } from "react";
import { LeafletPicker } from "./LeafletMap";

const DHAKA_CENTER: [number, number] = [23.8103, 90.4125];

interface Props {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
}

export default function LocationPicker({ onLocationSelect }: Props) {
  const [center, setCenter] = useState<[number, number]>(DHAKA_CENTER);
  const [marker, setMarker] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const resolveAndSelect = useCallback(
    (lat: number, lng: number) => {
      setCenter([lat, lng]);
      setMarker([lat, lng]);
      // Reverse geocode via Nominatim (free, no API key)
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { "Accept-Language": "en" },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.display_name) {
            onLocationSelect(lat, lng, data.display_name);
          } else {
            onLocationSelect(lat, lng);
          }
        })
        .catch(() => {
          onLocationSelect(lat, lng);
        });
    },
    [onLocationSelect]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    doSearch();
  };

  const doSearch = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setCenter([lat, lng]);
          setMarker([lat, lng]);
          onLocationSelect(lat, lng, data[0].display_name ?? searchQuery);
        }
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setSearching(false));
  };

  const detectLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolveAndSelect(pos.coords.latitude, pos.coords.longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied. Please enable location access in your browser settings."
            : "Could not detect your location. Please try selecting a location manually."
        );
      }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search address or place"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doSearch(); } }}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => void doSearch()}
          disabled={searching}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide disabled:opacity-50"
        >
          {searching ? "..." : "Search"}
        </button>
      </div>

      <button
        type="button"
        onClick={detectLocation}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
      >
        Use My Current Location
      </button>

      <LeafletPicker
        center={center}
        marker={marker}
        height="320px"
        onMapClick={(lat, lng) => resolveAndSelect(lat, lng)}
        onMarkerDrag={(lat, lng) => resolveAndSelect(lat, lng)}
      />
    </div>
  );
}
