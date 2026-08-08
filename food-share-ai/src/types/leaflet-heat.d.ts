// Type declarations for the `leaflet.heat` plugin.
// The package ships as a UMD script (dist/leaflet-heat.js) that attaches
// `L.heatLayer` to the Leaflet namespace, so we augment the existing module.
import * as L from 'leaflet';

declare module 'leaflet' {
  interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: HeatLayerOptions
  ): Layer;
}
