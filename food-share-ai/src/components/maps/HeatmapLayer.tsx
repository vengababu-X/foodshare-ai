'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import 'leaflet.heat';

export interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number; // 0-1
}

interface HeatmapLayerProps {
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  max?: number;
  minOpacity?: number;
  gradient?: Record<number, string>;
}

const DEFAULT_GRADIENT: Record<number, string> = {
  0.2: '#3B82F6',
  0.4: '#22C55E',
  0.6: '#EAB308',
  0.8: '#F97316',
  1.0: '#EF4444',
};

export default function HeatmapLayer({
  points,
  radius = 25,
  blur = 15,
  max = 1,
  minOpacity = 0.35,
  gradient = DEFAULT_GRADIENT,
}: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    // Only ever runs client-side (the map itself is dynamic-imported with
    // ssr: false), but guard anyway for safety.
    if (typeof window === 'undefined' || !points.length) return;

    const heat = L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.intensity] as [number, number, number]),
      { radius, blur, max, minOpacity, gradient }
    ).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points, radius, blur, max, minOpacity, gradient]);

  return null;
}
