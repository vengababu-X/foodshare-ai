import type { Coordinates } from '@/types';

/**
 * Real driving-route vectors from the OSRM public routing server
 * (https://project-osrm.org) — no API key required. Returns the road network
 * polyline between pickup and drop-off so the Leaflet map renders an actual
 * driving route instead of a straight line.
 */

export interface DrivingRoute {
  distanceKm: number;
  durationMin: number;
  /** [lat, lng] pairs along the road network */
  coordinates: Array<[number, number]>;
}

const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetch a driving route between two coordinates. Returns null when the
 * routing service is unreachable so callers can fall back to a straight line.
 */
export async function getDrivingRoute(
  from: Coordinates,
  to: Coordinates
): Promise<DrivingRoute | null> {
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_ENDPOINT}/${coordinates}?overview=full&geometries=geojson&steps=false`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      code: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: Array<[number, number]> };
      }>;
    };

    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) return null;

    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
  } catch (error) {
    console.error('OSRM routing request failed:', error);
    return null;
  }
}

export default {
  getDrivingRoute,
};
