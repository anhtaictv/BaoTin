import 'dart:typed_data';
import 'package:exif/exif.dart';

class ExifGpsResult {
  const ExifGpsResult({this.lat, this.lng});

  final double? lat;
  final double? lng;

  bool get hasGps => lat != null && lng != null;
}

/// Reads GPS EXIF tags from raw photo bytes *before* any resize/compression step touches them —
/// preserving the citizen's original capture location (CLAUDE.md non-negotiable #6).
/// Works on native and Web (pure-Dart parser, no platform channel — unlike native_exif).
/// Returns an empty result (not an error) when the phone stripped GPS from the photo,
/// which is common and expected — callers should fall back to device GPS.
Future<ExifGpsResult> readExifGpsFromBytes(Uint8List bytes) async {
  try {
    final tags = await readExifFromBytes(bytes);
    final lat = _toDecimalDegrees(tags['GPS GPSLatitude'], tags['GPS GPSLatitudeRef']);
    final lng = _toDecimalDegrees(tags['GPS GPSLongitude'], tags['GPS GPSLongitudeRef']);
    if (lat == null || lng == null) return const ExifGpsResult();
    return ExifGpsResult(lat: lat, lng: lng);
  } catch (_) {
    return const ExifGpsResult();
  }
}

double? _toDecimalDegrees(IfdTag? coord, IfdTag? ref) {
  if (coord == null) return null;
  final parts = coord.values.toList();
  if (parts.length != 3) return null;
  final degrees = (parts[0] as Ratio).toDouble();
  final minutes = (parts[1] as Ratio).toDouble();
  final seconds = (parts[2] as Ratio).toDouble();
  var decimal = degrees + minutes / 60 + seconds / 3600;
  final refStr = ref?.printable.trim().toUpperCase();
  if (refStr == 'S' || refStr == 'W') decimal = -decimal;
  return decimal;
}
