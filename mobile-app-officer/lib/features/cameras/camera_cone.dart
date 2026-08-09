import 'dart:math' as math;
import 'package:latlong2/latlong.dart' as latlong;

const _earthRadiusM = 6371000.0;

double _toRad(double deg) => deg * math.pi / 180;
double _toDeg(double rad) => rad * 180 / math.pi;

latlong.LatLng _destinationPoint(latlong.LatLng from, double bearingDeg, double distanceM) {
  final lat1 = _toRad(from.latitude);
  final lon1 = _toRad(from.longitude);
  final brng = _toRad(bearingDeg);
  final dR = distanceM / _earthRadiusM;

  final lat2 = math.asin(math.sin(lat1) * math.cos(dR) + math.cos(lat1) * math.sin(dR) * math.cos(brng));
  final lon2 = lon1 +
      math.atan2(
        math.sin(brng) * math.sin(dR) * math.cos(lat1),
        math.cos(dR) - math.sin(lat1) * math.sin(lat2),
      );
  return latlong.LatLng(_toDeg(lat2), _toDeg(lon2));
}

/// Points for a flutter_map Polygon approximating the "cone" a camera can see: the camera's
/// own position + an arc of points along the field-of-view edge. Purely visual — a fixed
/// [viewRadiusMeters], not a real optical range — so the officer UI can show roughly which
/// direction/area a camera faces without claiming surveying-grade accuracy.
List<latlong.LatLng> cameraConePolygon(
  latlong.LatLng center,
  double directionDegrees,
  double fovDegrees, {
  double viewRadiusMeters = 60,
  int segments = 8,
}) {
  final half = fovDegrees / 2;
  final start = directionDegrees - half;
  final points = <latlong.LatLng>[center];
  for (var i = 0; i <= segments; i++) {
    final bearing = start + (fovDegrees * i) / segments;
    points.add(_destinationPoint(center, bearing, viewRadiusMeters));
  }
  points.add(center);
  return points;
}
