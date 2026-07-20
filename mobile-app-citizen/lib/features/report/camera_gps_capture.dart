import 'dart:typed_data';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'exif_reader.dart';

class ResolvedLocation {
  const ResolvedLocation({required this.lat, required this.lng, required this.source});

  final double lat;
  final double lng;

  /// 'exif' | 'device_gps' | 'manual_pin' — matches backend report.schema.ts exactly.
  final String source;
}

/// Only ever launches the device's own camera/gallery — never accepts a photo forwarded
/// from another app's share sheet, since those channels (Zalo/Messenger) routinely strip
/// EXIF (CLAUDE.md non-negotiable #6).
class CameraGpsCapture {
  final ImagePicker _picker = ImagePicker();

  Future<XFile?> captureFromCamera() => _picker.pickImage(source: ImageSource.camera);

  Future<XFile?> pickFromGallery() => _picker.pickImage(source: ImageSource.gallery);
}

class LocationResolver {
  /// Tries EXIF GPS from the photo first; falls back to live device GPS if the photo has
  /// none (many phones disable geotagging by default in their camera settings).
  Future<ResolvedLocation?> resolveFromPhoto(Uint8List bytes) async {
    final exifGps = await readExifGpsFromBytes(bytes);
    if (exifGps.hasGps) {
      return ResolvedLocation(lat: exifGps.lat!, lng: exifGps.lng!, source: 'exif');
    }
    return resolveFromDevice();
  }

  Future<ResolvedLocation?> resolveFromDevice() async {
    if (!await _ensureLocationPermission()) return null;
    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    return ResolvedLocation(lat: position.latitude, lng: position.longitude, source: 'device_gps');
  }

  Future<bool> _ensureLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }
}
