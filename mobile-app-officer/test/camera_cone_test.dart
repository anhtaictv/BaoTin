import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart' as latlong;
import 'package:bao_tin_officer/features/cameras/camera_cone.dart';

const _center = latlong.LatLng(12.68, 108.05);

void main() {
  test('starts and ends at the camera position, framing a closed fan shape', () {
    final points = cameraConePolygon(_center, 90, 60);
    expect(points.first, _center);
    expect(points.last, _center);
  });

  test('returns one arc point per segment plus the two center points', () {
    final points = cameraConePolygon(_center, 0, 90, segments: 8);
    expect(points.length, 8 + 1 + 2);
  });

  test('a camera facing due east (90°) moves the arc points east, not north/south', () {
    final points = cameraConePolygon(_center, 90, 10, segments: 4);
    final arcPoints = points.sublist(1, points.length - 1);
    for (final p in arcPoints) {
      expect(p.longitude, greaterThan(_center.longitude));
      expect(p.latitude, closeTo(_center.latitude, 0.001));
    }
  });

  test('a camera facing due north (0°) moves the arc points north, not east/west', () {
    final points = cameraConePolygon(_center, 0, 10, segments: 4);
    final arcPoints = points.sublist(1, points.length - 1);
    for (final p in arcPoints) {
      expect(p.latitude, greaterThan(_center.latitude));
      expect(p.longitude, closeTo(_center.longitude, 0.001));
    }
  });
}
