import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_citizen/core/api_client.dart';
import 'package:bao_tin_citizen/core/secure_token_store.dart';
import 'package:bao_tin_citizen/features/report/pending_reports_queue.dart';
import 'package:bao_tin_citizen/features/report/report_repository.dart';

class _FakeReportRepository extends ReportRepository {
  _FakeReportRepository(super.apiClient, {this.shouldFail = false, this.sessionExpired = false});

  final bool shouldFail;
  final bool sessionExpired;
  final List<String> submittedCategories = [];
  final List<String?> submittedClientRequestIds = [];

  @override
  Future<String> createReport({
    required String category,
    String? description,
    required double lat,
    required double lng,
    required String locationSource,
    String? clientRequestId,
    List<({Uint8List bytes, String filename})> attachments = const [],
  }) async {
    if (sessionExpired) {
      throw DioException(
        requestOptions: RequestOptions(path: '/reports'),
        error: SessionExpiredException(),
      );
    }
    if (shouldFail) throw Exception('still offline');
    submittedCategories.add(category);
    submittedClientRequestIds.add(clientRequestId);
    return 'r-${submittedCategories.length}';
  }
}

class _FakeSecureKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> _values = {};

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<void> write(String key, String value) async => _values[key] = value;

  @override
  Future<void> delete(String key) async => _values.remove(key);
}

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
    final repo =
        _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()));
    final queue = PendingReportsQueue(repo, storage: _FakeSecureKeyValueStore());

    await queue.enqueue(_report('a'));
    final pending = await queue.listPending();

    expect(pending, hasLength(1));
    expect(pending.single.id, 'a');
    expect(pending.single.category, 'trom_cap');
  });

  test('flush submits every queued report and empties the queue on success',
      () async {
    final repo =
        _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()));
    final queue = PendingReportsQueue(repo, storage: _FakeSecureKeyValueStore());

    await queue.enqueue(_report('a'));
    await queue.enqueue(_report('b'));

    final result = await queue.flush();

    expect(result.sent, 2);
    expect(result.sessionExpired, isFalse);
    expect(repo.submittedCategories, ['trom_cap', 'trom_cap']);
    expect(repo.submittedClientRequestIds, ['a', 'b']);
    expect(await queue.listPending(), isEmpty);
  });

  test('flush leaves a report queued when submission still fails', () async {
    final repo = _FakeReportRepository(
        ApiClient(tokenStore: SecureTokenStore()),
        shouldFail: true);
    final queue = PendingReportsQueue(repo, storage: _FakeSecureKeyValueStore());

    await queue.enqueue(_report('a'));
    final result = await queue.flush();

    expect(result.sent, 0);
    expect(result.sessionExpired, isFalse);
    expect(await queue.listPending(), hasLength(1));
  });

  test('flush reports sessionExpired distinctly from a plain offline failure', () async {
    final repo = _FakeReportRepository(
        ApiClient(tokenStore: SecureTokenStore()),
        sessionExpired: true);
    final queue = PendingReportsQueue(repo, storage: _FakeSecureKeyValueStore());

    await queue.enqueue(_report('a'));
    final result = await queue.flush();

    expect(result.sent, 0);
    expect(result.sessionExpired, isTrue);
    expect(await queue.listPending(), hasLength(1));
  });

  test('remove deletes only the matching report', () async {
    final repo =
        _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()));
    final queue = PendingReportsQueue(repo, storage: _FakeSecureKeyValueStore());

    await queue.enqueue(_report('a'));
    await queue.enqueue(_report('b'));
    await queue.remove('a');

    final pending = await queue.listPending();
    expect(pending, hasLength(1));
    expect(pending.single.id, 'b');
  });
}
