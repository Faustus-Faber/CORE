import {
  GoogleMap,
  Marker,
  StandaloneSearchBox,
  useLoadScript,
} from "@react-google-maps/api";
import { useRef, useState } from "react";

const containerStyle = {
  width: "100%",
  height: "320px",
};

const defaultCenter = {
  lat: 23.8103,
  lng: 90.4125,
};

const libraries: ("places")[] = ["places"];

interface Props {
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function LocationPicker({ onLocationSelect }: Props) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [center, setCenter] = useState(defaultCenter);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);

  const searchRef = useRef<google.maps.places.SearchBox | null>(null);

  if (!isLoaded) return <p>Loading map...</p>;

  const handlePlacesChanged = () => {
    const places = searchRef.current?.getPlaces();

    if (!places || places.length === 0) return;

    const location = places[0].geometry?.location;

    if (!location) return;

    const lat = location.lat();
    const lng = location.lng();

    setCenter({ lat, lng });
    setMarker({ lat, lng });

    onLocationSelect(lat, lng);
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setMarker({ lat, lng });

    onLocationSelect(lat, lng);
  };

  const handleDragEnd = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setMarker({ lat, lng });

    onLocationSelect(lat, lng);
  };

  const detectLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setCenter({ lat, lng });
      setMarker({ lat, lng });

      onLocationSelect(lat, lng);
    });
  };

  return (
    <div className="space-y-2">
      {/* Search */}
      <StandaloneSearchBox
        onLoad={(ref) => (searchRef.current = ref)}
        onPlacesChanged={handlePlacesChanged}
      >
        <input
          type="text"
          placeholder="Search address or place"
          className="border p-2 w-full rounded"
        />
      </StandaloneSearchBox>

      {/* Detect location button */}
      <button
        type="button"
        onClick={detectLocation}
        className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
      >
        📍 Use My Current Location
      </button>

      {/* Map */}
      <GoogleMap
        mapContainerStyle={containerStyle}
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