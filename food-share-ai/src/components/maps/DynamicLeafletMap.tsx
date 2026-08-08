'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import type { HeatPoint } from './HeatmapLayer';

// Dynamic import for LeafletMap to avoid SSR issues
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="map-container bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 mt-4">Loading map...</p>
      </div>
    </div>
  ),
});

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

interface DynamicLeafletMapProps {
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

export default function DynamicLeafletMap(props: DynamicLeafletMapProps) {
  return <LeafletMap {...props} />;
}