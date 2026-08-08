'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Heart } from 'lucide-react';

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

interface GoogleMapProps {
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
}

export default function GoogleMap({
  markers,
  center = { lat: 17.3850, lng: 78.4867 }, // Hyderabad, India
  zoom = 12,
  onMarkerClick,
  showRoute = false,
  routeCoordinates = [],
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapLoaded) return;

    const initMap = async () => {
      try {
        // Check if Google Maps API is loaded
        if (typeof window === 'undefined' || !window.google?.maps) {
          // For demo purposes, show a placeholder
          setMapLoaded(true);
          return;
        }

        const newMap = new google.maps.Map(mapRef.current!, {
          center,
          zoom,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        setMap(newMap);
        setMapLoaded(true);
      } catch (err) {
        console.error('Error loading map:', err);
        setError('Failed to load Google Maps');
        setMapLoaded(true);
      }
    };

    // Load Google Maps API script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey && !window.google?.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      script.onerror = () => {
        setError('Failed to load Google Maps API');
        setMapLoaded(true);
      };
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      // Cleanup
    };
  }, [center, zoom, mapLoaded]);

  // Add markers to map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    // Clear existing markers
    // In a real implementation, you'd track markers and clear them

    // Add new markers
    markers.forEach((marker) => {
      const icon = getMarkerIcon(marker.type);
      
      const markerOptions: google.maps.MarkerOptions = {
        position: marker.position,
        map: map,
        title: marker.title,
        icon: {
          url: icon,
          scaledSize: new google.maps.Size(32, 32),
        },
        animation: google.maps.Animation.DROP,
      };

      const mapMarker = new google.maps.Marker(markerOptions);

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; max-width: 200px;">
            <h3 style="font-weight: bold; margin-bottom: 5px;">${marker.title}</h3>
            ${marker.info ? `<p style="color: #666; font-size: 14px;">${marker.info}</p>` : ''}
            <p style="color: #999; font-size: 12px; margin-top: 5px;">
              ${marker.position.lat.toFixed(4)}, ${marker.position.lng.toFixed(4)}
            </p>
          </div>
        `,
      });

      mapMarker.addListener('click', () => {
        infoWindow.open(map, mapMarker);
        onMarkerClick?.(marker);
      });
    });
  }, [map, markers, mapLoaded, onMarkerClick]);

  // Draw route if needed
  useEffect(() => {
    if (!map || !showRoute || routeCoordinates.length < 2) return;

    const path = routeCoordinates.map((coord) => 
      new google.maps.LatLng(coord.lat, coord.lng)
    );

    const routePath = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#10B981',
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map: map,
    });

    return () => {
      routePath.setMap(null);
    };
  }, [map, showRoute, routeCoordinates]);

  const getMarkerIcon = (type: string): string => {
    // In a real implementation, you'd use actual marker images
    // For now, we'll return placeholder data URIs
    const colors: Record<string, string> = {
      donation: '#F97316', // Orange
      ngo: '#3B82F6',     // Blue
      volunteer: '#8B5CF6', // Purple
      pickup: '#10B981',  // Green
      dropoff: '#EF4444', // Red
    };
    
    // Return a simple colored circle as SVG
    const color = colors[type] || '#6B7280';
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
    `)}`;
  };

  if (error) {
    return (
      <div className="map-container bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Unable to load map</p>
          <p className="text-sm text-gray-500">{error}</p>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Marker Locations:</strong>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-500">
              {markers.slice(0, 5).map((marker) => (
                <li key={marker.id}>
                  {marker.title}: {marker.position.lat.toFixed(4)}, {marker.position.lng.toFixed(4)}
                </li>
              ))}
              {markers.length > 5 && <li>...and {markers.length - 5} more</li>}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="map-container" />
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
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

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => map?.setZoom((map.getZoom() || 12) + 1)}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl font-bold text-gray-600">+</span>
        </button>
        <button
          onClick={() => map?.setZoom((map.getZoom() || 12) - 1)}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl font-bold text-gray-600">-</span>
        </button>
        <button
          onClick={() => map?.panTo(center)}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <Navigation className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Marker Count */}
      {markers.length > 0 && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
          <p className="text-sm font-medium text-gray-700">
            {markers.length} marker{markers.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}