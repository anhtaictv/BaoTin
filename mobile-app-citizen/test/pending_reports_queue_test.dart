import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_citizen/core/api_client.dart';
import 'package:bao_tin_citizen/core/secure_token_store.dart';
import 'package:bao_tin_citizen/features/report/pending_reports_queue.dart';
import 'package:bao_tin_citizen/features/report/report_repository.dart';

class _FakeReportRepository extends ReportRepository {
  _FakeReportRepository(super.apiClient, {this.shouldFail = false});

  final bool shouldFail;
  final List<String> submittedCategories = [];

  @override
  Future<String> createReport({
    required String category,
    String? description,
    required double lat,
    required double lng,
    required String locationSource,
    List<({Uint8List bytes, String filename})> attachments = const [],
  }) async {
    if (shouldFail) throw Exception('still offline');
    submittedCategories.add(category);
    return 'r-${submittedCategories.length}';
  }
}

Future<Directory> _tempDir() =>
    Directory.systemTemp.createTemp('pending_reports_test');

PendingReport _report(String id) => PendingReport(
      id: id,
      category: 'trom_cap',
      description: 'test',
      lat: 10.0,
      lng: 106.0,
      locationSource: 'device_gps',
      createdAt: DateTime(2026, 1, 1),
    );

void main() {
  test('enqueue then listPending returns the queued report', () async {
    final dir = await _tempDir();
    final repo =
        _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()));
    final queue = PendingReportsQueue(repo, directory: () async => dir);

    await queue.enqueue(_report('a'));
    final pending = await queue.listPending();

    expect(pending, hasLength(1));
    expect(pending.single.id, 'a');
    expect(pending.single.category, 'trom_cap');
  });

  test('flush submits every queued report and empties the queue on success',
      () async {
    final dir = await _tempDir();
    final repo =
        _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()));
    final queue = PendingReportsQueue(repo, directory: () async => dir);

    await queue.enqueue(_report('a'));
    await queue.enqueue(_report('b'));

    final sent = await queue.flush();

    expect(sent, 2);
    expect(repo.submittedCategories, ['trom_cap', 'trom_cap']);
    expect(await queue.listPending(), isEmpty);
  });

  test('flush leaves a report queued when submission still fails', () async {
    final dir = await _tempDir();
    final repo = _FakeReportRepository(
        ApiClient(tokenStore: SecureTokenStore()),
        shouldFail: true);
    final queue = PendingReportsQueue(repo, directory: () async => dir);

    await queue.enqueue(_report('a'));
    final sent = await queue.flush();

    expect(sent, 0);
    expect(await queue.listPending(), hasLength(1));
  });

  test('remove deletes only the matching report', () async {
    final dir = await _tempDir();
    final repo =
        _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()));
    final queue = PendingReportsQueue(repo, directory: () async => dir);

    await queue.enqueue(_report('a'));
    await queue.enqueue(_report('b'));
    await queue.remove('a');

    final pending = await queue.listPending();
    expect(pending, hasLength(1));
    expect(pending.single.id, 'b');
  });
}
