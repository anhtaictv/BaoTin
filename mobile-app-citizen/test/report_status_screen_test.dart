import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_citizen/core/api_client.dart';
import 'package:bao_tin_citizen/core/providers.dart';
import 'package:bao_tin_citizen/core/secure_token_store.dart';
import 'package:bao_tin_citizen/features/report/report_repository.dart';
import 'package:bao_tin_citizen/features/status/report_status_screen.dart';

class _FakeReportRepository extends ReportRepository {
  _FakeReportRepository(super.apiClient, this.status);

  final Map<String, dynamic> status;

  @override
  Future<Map<String, dynamic>> getStatus(String reportId) async => status;
}

Future<void> _pump(WidgetTester tester, Map<String, dynamic> status) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        reportRepositoryProvider.overrideWithValue(
          _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()), status),
        ),
      ],
      child: const MaterialApp(home: ReportStatusScreen(reportId: 'r1')),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  testWidgets('shows the VNeID suggestion for an emergency report', (tester) async {
    await _pump(tester, {'status': 'pending', 'urgency': 'emergency', 'category': 'khac'});
    expect(find.textContaining('gửi tố cáo chính thức qua ứng dụng VNeID'), findsOneWidget);
  });

  testWidgets('shows the VNeID suggestion for a high-priority category even if not emergency', (tester) async {
    await _pump(tester, {'status': 'verifying', 'urgency': 'normal', 'category': 'chay_no'});
    expect(find.textContaining('gửi tố cáo chính thức qua ứng dụng VNeID'), findsOneWidget);
  });

  testWidgets('does not show the suggestion for an ordinary report', (tester) async {
    await _pump(tester, {'status': 'pending', 'urgency': 'normal', 'category': 'trom_cap'});
    expect(find.textContaining('gửi tố cáo chính thức qua ứng dụng VNeID'), findsNothing);
  });

  testWidgets('does not show the suggestion once a serious report is confirmed false', (tester) async {
    await _pump(tester, {'status': 'confirmed_false', 'urgency': 'emergency', 'category': 'khac'});
    expect(find.textContaining('gửi tố cáo chính thức qua ứng dụng VNeID'), findsNothing);
  });

  testWidgets('shows the officer note when latestNote is present', (tester) async {
    await _pump(tester, {
      'status': 'verifying',
      'urgency': 'normal',
      'category': 'trom_cap',
      'latestNote': 'Đang xác minh tại hiện trường.',
    });
    expect(find.text('Ghi chú từ cán bộ phụ trách'), findsOneWidget);
    expect(find.text('Đang xác minh tại hiện trường.'), findsOneWidget);
  });

  testWidgets('does not show the note card when latestNote is null', (tester) async {
    await _pump(tester, {'status': 'pending', 'urgency': 'normal', 'category': 'trom_cap'});
    expect(find.text('Ghi chú từ cán bộ phụ trách'), findsNothing);
  });

  testWidgets('does not show the note card when latestNote is blank', (tester) async {
    await _pump(tester, {'status': 'pending', 'urgency': 'normal', 'category': 'trom_cap', 'latestNote': '   '});
    expect(find.text('Ghi chú từ cán bộ phụ trách'), findsNothing);
  });
}
