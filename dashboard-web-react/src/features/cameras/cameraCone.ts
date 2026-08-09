const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceM: number): [number, number] {
  const lat1 = toRad(lat);
  const lon1 = toRad(lng);
  const brng = toRad(bearingDeg);
  const dR = distanceM / EARTH_RADIUS_M;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
  const lon2 =
    lon1 +
    Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
  return [toDeg(lat2), toDeg(lon2)];
}

/**
 * [lat, lng] points for a Leaflet Polygon approximating the "cone" a camera can see: the
 * camera's own position + an arc of points along the field-of-view edge. Purely visual — a
 * fixed viewRadiusMeters, not a real optical range — so the officer UI can show roughly which
 * direction/area a camera faces without claiming surveying-grade accuracy.
 */
export function cameraConePolygon(
  center: { lat: number; lng: number },
  directionDegrees: number,
  fovDegrees: number,
  viewRadiusMeters = 60,
  segments = 8,
): [number, number][] {
  const half = fovDegrees / 2;
  const start = directionDegrees - half;
  const points: [number, number][] = [[center.lat, center.lng]];
  for (let i = 0; i <= segments; i++) {
    const bearing = start + (fovDegrees * i) / segments;
    points.push(destinationPoint(center.lat, center.lng, bearing, viewRadiusMeters));
  }
  points.push([center.lat, center.lng]);
  return points;
}
