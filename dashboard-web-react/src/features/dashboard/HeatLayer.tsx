import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export type HeatPoint = [number, number, number?];

/** leaflet.heat has no @types package — it just bolts `heatLayer` onto the global `L` object,
 * so cast rather than fight the ambient module declaration in leaflet-heat.d.ts. */
const heatLayerFactory = L as unknown as {
  heatLayer: (points: HeatPoint[], options?: Record<string, unknown>) => L.Layer;
};

/** Density view for ReportsMap — reuses the same lat/lng points already fetched for the marker
 * view, no new API/query. Mount-only inside a MapContainer (needs useMap()). */
export function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const layer = heatLayerFactory.heatLayer(points, { radius: 22, blur: 18, maxZoom: 15 });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}
