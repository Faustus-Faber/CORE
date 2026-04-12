import {
  GoogleMap,
  Marker,
  StandaloneSearchBox,
  useLoadScript,
} from "@react-google-maps/api";
import { useCallback, useRef, useState } from "react";

const MAP_STYLE = { width: "100%", height: "320px", borderRadius: "0.75rem" };
const DHAKA_CENTER = { lat: 23.8103, lng: 90.4125 };
const LIBRARIES: ("places")[] = ["places"];

interface Props {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
}

export default function LocationPicker({ onLocationSelect }: Props) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [center, setCenter] = useState(DHAKA_CENTER);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const searchRef = useRef<google.maps.places.SearchBox | null>(null);

  const resolveAndSelect = useCallback(
    (lat: number, lng: number) => {
      setCenter({ lat, lng });
      setMarker({ lat, lng });

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          onLocationSelect(lat, lng, results[0].formatted_address);
        } else {
          onLocationSelect(lat, lng);
        }
      });
    },
    [onLocationSelect]
  );

  if (!isLoaded) return <p>Loading map...</p>;

  const handlePlacesChanged = () => {
    const places = searchRef.current?.getPlaces();
    if (!places || places.length === 0) return;

    const location = places[0].geometry?.location;
    const name = places[0].formatted_address ?? places[0].name ?? "";
    if (!location) return;

    const lat = location.lat();
    const lng = location.lng();
    setCenter({ lat, lng });
    setMarker({ lat, lng });
    onLocationSelect(lat, lng, name);
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    resolveAndSelect(e.latLng.lat(), e.latLng.lng());
  };

  const handleDragEnd = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    resolveAndSelect(e.latLng.lat(), e.latLng.lng());
  };

  const detectLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      resolveAndSelect(pos.coords.latitude, pos.coords.longitude);
    });
  };

  return (
    <div className="space-y-2">
      <StandaloneSearchBox
        onLoad={(ref) => (searchRef.current = ref)}
        onPlacesChanged={handlePlacesChanged}
      >
        <input
          type="text"
          placeholder="Search address or place"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
        />
      </StandaloneSearchBox>

      <button
        type="button"
        onClick={detectLocation}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
      >
        Use My Current Location
      </button>

      <GoogleMap
        mapContainerStyle={MAP_STYLE}
        center={center}
        zoom={13}
        onClick={handleMapClick}
      >
        {marker && (
          <Marker
            position={marker}
            draggable
            onDragEnd={handleDragEnd}
          />
        )}
      </GoogleMap>
    </div>
  );
}
