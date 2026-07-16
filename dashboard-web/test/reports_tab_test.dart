import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_dashboard/core/api_client.dart';
import 'package:bao_tin_dashboard/core/providers.dart';
import 'package:bao_tin_dashboard/core/secure_token_store.dart';
import 'package:bao_tin_dashboard/features/cameras/camera_repository.dart';
import 'package:bao_tin_dashboard/features/dashboard/dashboard_providers.dart';
import 'package:bao_tin_dashboard/features/reports/reports_providers.dart';
import 'package:bao_tin_dashboard/features/reports/reports_tab.dart';

const _fakeReports = [
  {'id': 'r1', 'category': 'Trộm cắp', 'status': 'pending', 'urgency': 'normal', 'createdAt': '2026-01-01T08:00:00Z'},
  {'id': 'r2', 'category': 'Cháy nổ', 'status': 'verifying', 'urgency': 'emergency', 'createdAt': '2026-01-01T09:00:00Z'},
];

const _fakeDetail = {
  'id': 'r1',
  'category': 'Trộm cắp',
  'urgency': 'normal',
  'status': 'pending',
  'description': 'Mất xe máy trước nhà',
  'location': {'lat': 12.68, 'lng': 108.05},
  'user': {'id': 'u1', 'anonymous': true},
  'attachments': <Map<String, dynamic>>[],
};

/// NearbyCamerasSection fetches on mount — a real ApiClient here would leave a Dio
/// connect-timeout Timer pending past the test's end (nothing listens on :3000 in
/// widget tests). This fake never touches the network.
class _FakeCameraRepository extends CameraRepository {
  _FakeCameraRepository(super.apiClient);

  @override
  Future<List<Map<String, dynamic>>> nearbyCameras(String reportId, {int radiusM = 500}) async => [];
}

void main() {
  testWidgets('ReportsTab lists incoming reports and shows detail + duyệt action on selection', (tester) async {
    tester.view.physicalSize = const Size(1400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          reportListProvider.overrideWith((ref) async => _fakeReports),
          reportDetailProvider('r1').overrideWith((ref) async => _fakeDetail),
          districtOptionsProvider.overrideWith((ref) async => const []),
          cameraRepositoryProvider.overrideWithValue(
            _FakeCameraRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: ReportsTab())),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Trộm cắp'), findsOneWidget);
    expect(find.text('Cháy nổ'), findsOneWidget);
    expect(find.text('Chọn 1 tin báo bên trái để xem chi tiết.'), findsOneWidget);

    await tester.tap(find.text('Trộm cắp'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Mất xe máy trước nhà'), findsOneWidget);
    expect(find.text('Ẩn danh (được bảo vệ)'), findsOneWidget);
    expect(find.text('Duyệt tin báo'), findsOneWidget);
    expect(find.text('Đúng sự thật'), findsWidgets);
  });

  testWidgets('below 900px shows the list first, then swaps to detail + a back button on selection',
      (tester) async {
    tester.view.physicalSize = const Size(700, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          reportListProvider.overrideWith((ref) async => _fakeReports),
          reportDetailProvider('r1').overrideWith((ref) async => _fakeDetail),
          districtOptionsProvider.overrideWith((ref) async => const []),
          cameraRepositoryProvider.overrideWithValue(
            _FakeCameraRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: ReportsTab())),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Narrow layout: list only, no split detail pane placeholder.
    expect(find.text('Trộm cắp'), findsOneWidget);
    expect(find.text('Chọn 1 tin báo bên trái để xem chi tiết.'), findsNothing);

    await tester.tap(find.text('Trộm cắp'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Mất xe máy trước nhà'), findsOneWidget);
    expect(find.text('Danh sách'), findsOneWidget);

    await tester.tap(find.text('Danh sách'));
    await tester.pump();

    expect(find.text('Trộm cắp'), findsOneWidget);
    expect(find.text('Mất xe máy trước nhà'), findsNothing);
  });
}
