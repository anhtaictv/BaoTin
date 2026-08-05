import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/api_client.dart';
import 'report_repository.dart';

/// Minimal key-value contract `PendingReportsQueue` needs — narrowed from
/// `FlutterSecureStorage`'s full API purely so tests can inject an in-memory fake instead of
/// hitting the real Keychain/Keystore platform channel (unavailable under `flutter test`,
/// same reasoning as `PendingReportsQueue`'s old `directory` override for path_provider).
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

/// A report that failed to submit for lack of connectivity, waiting for a retry.
/// Holds the picked photo's file *path* (not its bytes) — `image_picker`/the camera already
/// wrote it to disk, so re-reading it at flush time avoids keeping large byte blobs around in
/// a JSON queue file just because the user hasn't gotten signal back yet.
class PendingReport {
  PendingReport({
    required this.id,
    required this.category,
    this.description,
    required this.lat,
    required this.lng,
    required this.locationSource,
    this.photoPath,
    required this.createdAt,
  });

  final String id;
  final String category;
  final String? description;
  final double lat;
  final double lng;
  final String locationSource;
  final String? photoPath;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'category': category,
        'description': description,
        'lat': lat,
        'lng': lng,
        'locationSource': locationSource,
        'photoPath': photoPath,
        'createdAt': createdAt.toIso8601String(),
      };

  factory PendingReport.fromJson(Map<String, dynamic> json) => PendingReport(
        id: json['id'] as String,
        category: json['category'] as String,
        description: json['description'] as String?,
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        locationSource: json['locationSource'] as String,
        photoPath: json['photoPath'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// Local "sent later" queue for reports that couldn't reach the backend because of no
/// connectivity. Backed by Keychain/Keystore (via `flutter_secure_storage`, same as the JWT
/// tokens in `secure_token_store.dart`) rather than a plaintext file — queued reports carry
/// GPS + description text. A handful of queued items at most, so a real embedded DB
/// (sqlite/drift/isar) would be overkill for this app, which has none of those set up already.
///
/// Stored as one key per report (`pending_report_<id>`) plus an id-list key
/// (`pending_report_ids`), not a single blob — some Android Keystore implementations
/// (Samsung/Xiaomi) cap a single secure-storage entry at a few KB, and a handful of reports
/// with long descriptions could exceed that if packed into one value.
class PendingReportsQueue {
  static const _idsKey = 'pending_report_ids';

  // `storage` is overridable purely so unit tests can inject an in-memory fake instead of
  // needing the real Keychain/Keystore platform channel (unavailable under `flutter test`) —
  // production code never passes it, it always defaults to the real secure storage.
  PendingReportsQueue(this._repository, {SecureKeyValueStore? storage})
      : _storage = storage ?? const _FlutterSecureKeyValueStore(FlutterSecureStorage());

  final ReportRepository _repository;
  final SecureKeyValueStore _storage;

  Future<List<String>> _readIds() async {
    final raw = await _storage.read(_idsKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).cast<String>();
    } catch (_) {
      // Corrupt/unreadable id list — treat as empty rather than crashing the app on it.
      return [];
    }
  }

  Future<void> _writeIds(List<String> ids) => _storage.write(_idsKey, jsonEncode(ids));

  Future<List<PendingReport>> listPending() async {
    final ids = await _readIds();
    final reports = <PendingReport>[];
    for (final id in ids) {
      final raw = await _storage.read('pending_report_$id');
      if (raw == null) continue;
      try {
        reports.add(PendingReport.fromJson(jsonDecode(raw) as Map<String, dynamic>));
      } catch (_) {
        // Corrupt entry — skip it rather than crashing the whole list.
      }
    }
    return reports;
  }

  Future<void> enqueue(PendingReport report) async {
    await _storage.write('pending_report_${report.id}', jsonEncode(report.toJson()));
    final ids = await _readIds();
    if (!ids.contains(report.id)) {
      ids.add(report.id);
      await _writeIds(ids);
    }
  }

  Future<void> remove(String id) async {
    await _storage.delete('pending_report_$id');
    final ids = await _readIds();
    ids.remove(id);
    await _writeIds(ids);
  }

  /// Tries to actually submit every queued report via [ReportRepository.createReport],
  /// removing each one that succeeds. Items that still fail (still offline, or a fresh error)
  /// are left queued for the next flush or a manual retry — this never throws itself so a
  /// caller can fire-and-forget it from a connectivity listener or a background task.
  /// [sessionExpired] is true if any attempt failed because the refresh token itself is
  /// invalid/expired (ApiClient's interceptor already cleared it) — distinct from "still
  /// offline" so the UI can tell the person to log back in instead of just "try again later".
  Future<({int sent, bool sessionExpired})> flush() async {
    final reports = await listPending();
    var sent = 0;
    var sessionExpired = false;
    for (final report in reports) {
      try {
        var attachments = const <({Uint8List bytes, String filename})>[];
        final photoPath = report.photoPath;
        if (photoPath != null) {
          final photoFile = File(photoPath);
          if (await photoFile.exists()) {
            attachments = [
              (
                bytes: await photoFile.readAsBytes(),
                filename: photoFile.uri.pathSegments.last
              )
            ];
          }
        }
        await _repository.createReport(
          category: report.category,
          description: report.description,
          lat: report.lat,
          lng: report.lng,
          locationSource: report.locationSource,
          clientRequestId: report.id,
          attachments: attachments,
        );
        await remove(report.id);
        sent++;
      } on DioException catch (e) {
        if (e.error is SessionExpiredException) sessionExpired = true;
        // Still failing — leave it queued, next flush (or manual retry) will try again.
      } catch (_) {
        // Still failing — leave it queued, next flush (or manual retry) will try again.
      }
    }
    return (sent: sent, sessionExpired: sessionExpired);
  }
}
