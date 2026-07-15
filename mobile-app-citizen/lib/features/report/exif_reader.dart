import 'package:native_exif/native_exif.dart';

class ExifGpsResult {
  const ExifGpsResult({this.lat, this.lng});

  final double? lat;
  final double? lng;

  bool get hasGps => lat != null && lng != null;
}

/// Reads GPS EXIF tags from a photo file *before* any resize/compression step touches it —
/// preserving the citizen's original capture location (CLAUDE.md non-negotiable #6).
/// Returns an empty result (not an error) when the phone stripped GPS from the photo,
/// which is common and expected — callers should fall back to device GPS.
Future<ExifGpsResult> readExifGps(String filePath) async {
  final exif = await Exif.fromPath(filePath);
  try {
    final coords = await exif.getLatLong();
    if (coords == null) return const ExifGpsResult();
    return ExifGpsResult(lat: coords.latitude, lng: coords.longitude);
  } catch (_) {
    return const ExifGpsResult();
  } finally {
    await exif.close();
  }
}
