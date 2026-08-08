'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import HeatmapLayer, { HeatPoint } from './HeatmapLayer';

// Fix for default marker icons in Leaflet with webpack.
// Guarded so this module can never touch `window`/`L.Icon` during SSR —
// the component is loaded client-side via next/dynamic with ssr: false.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

interface MapMarker {
  id: string;
  position: {
    lat: number;
    lng: number;
  };
  title: string;
  type: 'donation' | 'ngo' | 'volunteer' | 'pickup' | 'dropoff';
  info?: string;
}

interface LeafletMapProps {
  markers: MapMarker[];
  center?: {
    lat: number;
    lng: number;
  };
  zoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  showRoute?: boolean;
  routeCoordinates?: {
    lat: number;
    lng: number;
  }[];
  heatmapPoints?: HeatPoint[];
}

// Custom marker icons
const createCustomIcon = (type: string) => {
  const colors: Record<string, string> = {
    donation: '#F97316',
    ngo: '#3B82F6',
    volunteer: '#8B5CF6',
    pickup: '#10B981',
    dropoff: '#EF4444',
  };
  
  const color = colors[type] || '#6B7280';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background-color: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
};

// Component to handle map interactions
function MapController({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center, zoom]);
  
  return null;
}

// Fits the viewport to all markers + route points so nothing is ever cut off.
function FitBounds({
  markers,
  routeCoordinates,
}: {
  markers: MapMarker[];
  routeCoordinates: { lat: number; lng: number }[];
}) {
  const map = useMap();

  useEffect(() => {
    const points = [
      ...markers.map((m) => [m.position.lat, m.position.lng] as [number, number]),
      ...routeCoordinates.map((c) => [c.lat, c.lng] as [number, number]),
    ];
    if (points.length < 2) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers.length, routeCoordinates.length]);

  return null;
}

export default function LeafletMap({
  markers,
  center = { lat: 17.3850, lng: 78.4867 }, // Hyderabad, India
  zoom = 12,
  onMarkerClick,
  showRoute = false,
  routeCoordinates = [],
  heatmapPoints = [],
}: LeafletMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="map-container bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="map-container"
        style={{ height: '400px', width: '100%', borderRadius: '1rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={center} zoom={zoom} />
        <FitBounds markers={markers} routeCoordinates={routeCoordinates} />

        {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}
        
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={createCustomIcon(marker.type)}
            eventHandlers={{
              click: () => onMarkerClick?.(marker),
            }}
          >
            <Popup>
              <div className="p-2 max-w-[200px]">
                <h3 className="font-bold text-gray-900">{marker.title}</h3>
                {marker.info && <p className="text-gray-600 text-sm mt-1">{marker.info}</p>}
                <p className="text-gray-400 text-xs mt-2">
                  {marker.position.lat.toFixed(4)}, {marker.position.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {showRoute && routeCoordinates.length >= 2 && (
          <Polyline
            positions={routeCoordinates.map((coord) => [coord.lat, coord.lng])}
            pathOptions={{
              color: '#10B981',
              weight: 4,
              opacity: 0.8,
            }}
          />
        )}
      </MapContainer>
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-[1000]">
        <p className="text-xs font-medium text-gray-700 mb-2">Legend</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-xs text-gray-600">Donation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-600">NGO</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-xs text-gray-600">Volunteer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-gray-600">Pickup</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-gray-600">Dropoff</span>
          </div>
        </div>
      </div>

      {/* Marker Count */}
      {markers.length > 0 && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[1000]">
          <p className="text-sm font-medium text-gray-700">
            {markers.length} marker{markers.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}