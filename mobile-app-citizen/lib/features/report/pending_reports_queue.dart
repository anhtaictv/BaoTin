import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'report_repository.dart';

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
/// connectivity. Just a JSON file under the app's documents directory — a handful of queued
/// items at most, so a real embedded DB (sqlite/drift/isar) would be overkill for this app,
/// which has none of those set up already.
///
/// ponytail: file is read+rewritten in full on every enqueue/remove (no incremental append,
/// no lock against concurrent writers). Fine at citizen-app scale (a person queues a handful
/// of reports, not hundreds); move to a real embedded DB if that stops being true.
class PendingReportsQueue {
  // `directory` is overridable purely so unit tests can point the queue at a temp folder
  // instead of needing a real path_provider platform channel (unavailable under `flutter
  // test`) — production code never passes it, it always defaults to the real documents dir.
  PendingReportsQueue(this._repository,
      {Future<Directory> Function()? directory})
      : _directory = directory ?? getApplicationDocumentsDirectory;

  final ReportRepository _repository;
  final Future<Directory> Function() _directory;

  Future<File> _file() async {
    final dir = await _directory();
    return File('${dir.path}/pending_reports.json');
  }

  Future<List<PendingReport>> listPending() async {
    final file = await _file();
    if (!await file.exists()) return [];
    try {
      final raw = jsonDecode(await file.readAsString()) as List;
      return raw
          .map((e) => PendingReport.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      // Corrupt/unreadable queue file — treat as empty rather than crashing the app on it.
      return [];
    }
  }

  Future<void> _save(List<PendingReport> reports) async {
    final file = await _file();
    await file
        .writeAsString(jsonEncode(reports.map((r) => r.toJson()).toList()));
  }

  Future<void> enqueue(PendingReport report) async {
    final reports = await listPending();
    reports.add(report);
    await _save(reports);
  }

  Future<void> remove(String id) async {
    final reports = await listPending();
    reports.removeWhere((r) => r.id == id);
    await _save(reports);
  }

  /// Tries to actually submit every queued report via [ReportRepository.createReport],
  /// removing each one that succeeds. Items that still fail (still offline, or a fresh error)
  /// are left queued for the next flush or a manual retry — this never throws itself so a
  /// caller can fire-and-forget it from a connectivity listener.
  /// Returns how many were sent successfully.
  Future<int> flush() async {
    final reports = await listPending();
    var sent = 0;
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
          attachments: attachments,
        );
        await remove(report.id);
        sent++;
      } catch (_) {
        // Still failing — leave it queued, next flush (or manual retry) will try again.
      }
    }
    return sent;
  }
}
