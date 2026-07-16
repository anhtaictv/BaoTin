import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_dashboard/core/api_client.dart';
import 'package:bao_tin_dashboard/core/providers.dart';
import 'package:bao_tin_dashboard/core/secure_token_store.dart';
import 'package:bao_tin_dashboard/features/reports/reports_repository.dart';
import 'package:bao_tin_dashboard/features/reports/widgets/status_update_action.dart';

/// Overrides updateStatus entirely — never touches the real ApiClient/network, mirroring
/// the _FakeCameraRepository pattern in reports_tab_test.dart.
class _FakeReportsRepository extends ReportsRepository {
  _FakeReportsRepository({this.shouldFail = false}) : super(ApiClient(tokenStore: SecureTokenStore()));

  final bool shouldFail;
  String? lastReportId;
  String? lastStatus;
  String? lastNote;

  @override
  Future<void> updateStatus(String reportId, String status, {String? note}) async {
    if (shouldFail) throw Exception('boom');
    lastReportId = reportId;
    lastStatus = status;
    lastNote = note;
  }
}

void main() {
  testWidgets('submits the chosen status and shows a confirmation snackbar', (tester) async {
    final fakeRepo = _FakeReportsRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [reportsRepositoryProvider.overrideWithValue(fakeRepo)],
        child: const MaterialApp(home: Scaffold(body: StatusUpdateAction(reportId: 'r1'))),
      ),
    );

    // No status chosen yet — submit shows the validation error, not a network call.
    await tester.tap(find.text('Xác nhận trạng thái'));
    await tester.pump();
    expect(find.text('Hãy chọn một trạng thái xác minh.'), findsOneWidget);
    expect(fakeRepo.lastStatus, isNull);

    await tester.tap(find.text('Đúng sự thật'));
    await tester.pump();
    await tester.tap(find.text('Xác nhận trạng thái'));
    await tester.pump();

    expect(fakeRepo.lastReportId, 'r1');
    expect(fakeRepo.lastStatus, 'confirmed_true');
    expect(find.text('Đã cập nhật trạng thái.'), findsOneWidget);
  });

  testWidgets('shows an error message when the update request fails', (tester) async {
    final fakeRepo = _FakeReportsRepository(shouldFail: true);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [reportsRepositoryProvider.overrideWithValue(fakeRepo)],
        child: const MaterialApp(home: Scaffold(body: StatusUpdateAction(reportId: 'r1'))),
      ),
    );

    await tester.tap(find.text('Tin sai'));
    await tester.pump();
    await tester.tap(find.text('Xác nhận trạng thái'));
    await tester.pump();

    expect(find.text('Cập nhật thất bại. Vui lòng thử lại.'), findsOneWidget);
  });
}
