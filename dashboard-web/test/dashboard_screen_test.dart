import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_dashboard/features/dashboard/dashboard_providers.dart';
import 'package:bao_tin_dashboard/features/dashboard/dashboard_screen.dart';
import 'package:bao_tin_dashboard/features/reports/reports_providers.dart';
import 'package:bao_tin_dashboard/features/signals/signals_providers.dart';

/// Renders the real DashboardScreen (KPI cards + all 4 fl_chart widgets + filter bar +
/// camera queue tiles) against fixed fake data, bypassing auth entirely by overriding the
/// data providers directly. Static analysis (`flutter analyze`) confirms the code compiles,
/// but only an actual widget pump exercises fl_chart's runtime layout — this is the one
/// thing analyze cannot catch (a chart widget that compiles but throws at render time).
///
/// DashboardScreen's IndexedStack mounts all 3 tabs up front (so switching tabs doesn't
/// re-fetch), so reportListProvider/signalListProvider must be overridden too even though
/// this test only asserts on the Overview tab — otherwise the hidden tabs' real network
/// calls (and Reports' polling Stream.periodic(20s)) keep scheduling frames forever and
/// pumpAndSettle times out.
void main() {
  testWidgets('DashboardScreen renders KPI cards and every chart without throwing', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          districtOptionsProvider.overrideWith(
            (ref) async => [
              {'id': 'd1', 'tenXa': 'Buôn Ma Thuột'},
              {'id': 'd2', 'tenXa': 'Buôn Hồ'},
            ],
          ),
          overviewProvider.overrideWith(
            (ref) async => {
              'totalReports': 12,
              'byStatus': {'pending': 3, 'verifying': 2, 'confirmed_true': 6, 'confirmed_false': 1},
              'byUrgency': {'emergency': 2, 'normal': 10},
              'avgResponseTimeSeconds': 185.0,
            },
          ),
          responseTimeByDistrictProvider.overrideWith(
            (ref) async => [
              {'districtId': 'd1', 'districtName': 'Buôn Ma Thuột', 'avgResponseTimeSeconds': 200.0, 'reportCount': 8},
              {'districtId': 'd2', 'districtName': 'Buôn Hồ', 'avgResponseTimeSeconds': 90.0, 'reportCount': 4},
            ],
          ),
          responseTimeByOfficerProvider.overrideWith(
            (ref) async => [
              {'officerId': 'o1', 'officerName': '[DEMO] Nguyễn Văn A', 'unitName': 'Công an X', 'avgResponseTimeSeconds': 150.0, 'reportCount': 5},
            ],
          ),
          volumeTrendProvider.overrideWith(
            (ref) async => [
              {'date': '2026-01-01', 'count': 3},
              {'date': '2026-01-02', 'count': 5},
              {'date': '2026-01-03', 'count': 2},
            ],
          ),
          cameraQueueProvider.overrideWith(
            (ref) async => {'pending': 2, 'sent': 1, 'fulfilled': 4, 'rejected': 0},
          ),
          reportListProvider.overrideWith((ref) async => []),
          signalListProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(home: DashboardScreen()),
      ),
    );

    // Let every FutureProvider above resolve and the widget tree settle.
    await tester.pumpAndSettle();

    expect(find.text('Báo Tin — Trung tâm điều hành'), findsOneWidget);
    expect(find.text('Tổng số tin'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('Thời gian phản hồi TB theo địa bàn'), findsOneWidget);
    expect(find.text('Thời gian phản hồi TB theo cán bộ'), findsOneWidget);
    expect(find.text('Xu hướng số tin theo ngày'), findsOneWidget);
    expect(find.text('Phân bổ trạng thái'), findsOneWidget);
    expect(find.text('Hàng đợi yêu cầu trích xuất camera'), findsOneWidget);
    // No error placeholders should appear anywhere in the tree.
    expect(find.text('Không tải được dữ liệu.'), findsNothing);
  });

  testWidgets('a failed chart provider renders ChartCardError with a working retry, others unaffected',
      (tester) async {
    tester.view.physicalSize = const Size(1400, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    var officerCallCount = 0;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          districtOptionsProvider.overrideWith((ref) async => const []),
          overviewProvider.overrideWith(
            (ref) async => {
              'totalReports': 0,
              'byStatus': <String, dynamic>{},
              'byUrgency': <String, dynamic>{},
              'avgResponseTimeSeconds': null,
            },
          ),
          responseTimeByDistrictProvider.overrideWith((ref) async => []),
          responseTimeByOfficerProvider.overrideWith((ref) {
            officerCallCount++;
            return Future<List<Map<String, dynamic>>>.error(Exception('boom'));
          }),
          volumeTrendProvider.overrideWith((ref) async => []),
          cameraQueueProvider.overrideWith((ref) async => <String, dynamic>{}),
          reportListProvider.overrideWith((ref) async => []),
          signalListProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(home: DashboardScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Không tải được dữ liệu.'), findsOneWidget);
    expect(officerCallCount, 1);

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();

    expect(officerCallCount, 2);
  });
}
