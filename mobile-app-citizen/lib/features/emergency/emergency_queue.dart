import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Minimal key-value contract for secure storage of emergency reports.
abstract class SecureKeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class _FlutterSecureKeyValueStore implements SecureKeyValueStore {
  const _FlutterSecureKeyValueStore(this._storage);
  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);
  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Emergency report queued for retry (no photo, just type + location).
class QueuedEmergency {
  QueuedEmergency({
    required this.id,
    required this.emergencyType,
    required this.lat,
    required this.lng,
    required this.createdAt,
  });

  final String id;
  final String emergencyType;
  final double lat;
  final double lng;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'emergencyType': emergencyType,
        'lat': lat,
        'lng': lng,
        'createdAt': createdAt.toIso8601String(),
      };

  factory QueuedEmergency.fromJson(Map<String, dynamic> json) => QueuedEmergency(
        id: json['id'] as String,
        emergencyType: json['emergencyType'] as String,
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// Local queue for SOS reports that failed to send — retry when connectivity returns.
/// Lighter than PendingReportsQueue (no attachments, no repository dependency).
class EmergencyQueue {
  static const _idsKey = 'emergency_queue_ids';

  EmergencyQueue({SecureKeyValueStore? storage})
      : _storage = storage ?? const _FlutterSecureKeyValueStore(FlutterSecureStorage());

  final SecureKeyValueStore _storage;

  Future<List<String>> _readIds() async {
    final raw = await _storage.read(_idsKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).cast<String>();
    } catch (_) {
      return [];
    }
  }

  Future<void> _writeIds(List<String> ids) => _storage.write(_idsKey, jsonEncode(ids));

  Future<List<QueuedEmergency>> listPending() async {
    final ids = await _readIds();
    final emergencies = <QueuedEmergency>[];
    for (final id in ids) {
      final raw = await _storage.read('emergency_$id');
      if (raw == null) continue;
      try {
        emergencies.add(QueuedEmergency.fromJson(jsonDecode(raw) as Map<String, dynamic>));
      } catch (_) {
        // Corrupt entry — skip it.
      }
    }
    return emergencies;
  }

  Future<void> enqueue(QueuedEmergency emergency) async {
    await _storage.write('emergency_${emergency.id}', jsonEncode(emergency.toJson()));
    final ids = await _readIds();
    if (!ids.contains(emergency.id)) {
      ids.add(emergency.id);
      await _writeIds(ids);
    }
  }

  Future<void> remove(String id) async {
    await _storage.delete('emergency_$id');
    final ids = await _readIds();
    ids.remove(id);
    await _writeIds(ids);
  }

  /// Attempt to submit all queued emergencies. Returns how many succeeded.
  /// Does not throw — caller can handle "still offline" by checking sentCount == 0.
  Future<int> flush(Future<String> Function(String, double, double, String) submitFn) async {
    final emergencies = await listPending();
    var sent = 0;
    for (final e in emergencies) {
      try {
        await submitFn(e.id, e.lat, e.lng, e.emergencyType);
        await remove(e.id);
        sent++;
      } catch (_) {
        // Still failing — leave it queued for next flush.
      }
    }
    return sent;
  }
}
