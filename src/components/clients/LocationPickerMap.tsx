'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon URLs break under bundlers (webpack/turbopack
// rewrite the asset paths it expects) — point them at the CDN copies instead.
// This must run once, client-side only.
// @ts-expect-error - _getIconUrl is a private Leaflet internal we're deleting to force the CDN fallback below
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]; // Riyadh — used only when the client has no saved location yet.

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Only pans the map when `flyTo` itself changes identity (e.g. a search
// result was picked) — NOT on every marker click/drag, which would make
// fine-tuning the pin feel jumpy as the view snapped to follow it.
function FlyToOnSearch({ flyTo }: { flyTo: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);
  return null;
}

export interface LocationPickerMapProps {
  initialLat?: number | null;
  initialLng?: number | null;
  flyTo?: [number, number] | null;
  onChange: (lat: number, lng: number) => void;
}

export default function LocationPickerMap({ initialLat, initialLng, flyTo, onChange }: LocationPickerMapProps) {
  const hasInitial = typeof initialLat === 'number' && typeof initialLng === 'number';
  const [position, setPosition] = useState<[number, number]>(
    hasInitial ? [initialLat as number, initialLng as number] : DEFAULT_CENTER
  );
  const markerRef = useRef<L.Marker>(null);

  const move = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onChange(lat, lng);
  };

  useEffect(() => {
    if (flyTo) move(flyTo[0], flyTo[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  return (
    <MapContainer
      center={position}
      zoom={hasInitial ? 15 : 6}
      style={{ height: '360px', width: '100%', borderRadius: '10px' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={position}
        draggable
        ref={markerRef}
        eventHandlers={{
          dragend: () => {
            const marker = markerRef.current;
            if (marker) {
              const latlng = marker.getLatLng();
              move(latlng.lat, latlng.lng);
            }
          },
        }}
      />
      <ClickToMove onMove={move} />
      <FlyToOnSearch flyTo={flyTo ?? null} />
    </MapContainer>
  );
}
