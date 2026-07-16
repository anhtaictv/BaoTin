// DEMO-ONLY entry point — renders DashboardScreen with fixed fake data via provider
// overrides (same technique as test/dashboard_screen_test.dart), bypassing auth and the
// real backend entirely. Use for visual preview only:
//   flutter run -d chrome -t lib/main_demo.dart
// The real app entry point (lib/main.dart) is untouched and still requires a running
// backend + Postgres.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/api_client.dart';
import 'core/providers.dart';
import 'core/secure_token_store.dart';
import 'core/theme.dart';
import 'features/cameras/camera_repository.dart';
import 'features/dashboard/dashboard_providers.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/reports/reports_providers.dart';

/// Fixed pool of demo reports, revealed one at a time as `_demoTickProvider` advances —
/// simulates "tin mới tự xuất hiện trên dashboard" without needing a real backend.
const _demoReportPool = [
  {'id': 'demo-1', 'category': 'Trộm cắp', 'status': 'pending', 'urgency': 'normal'},
  {'id': 'demo-2', 'category': 'Cháy nổ', 'status': 'pending', 'urgency': 'emergency'},
  {'id': 'demo-3', 'category': 'Tai nạn', 'status': 'verifying', 'urgency': 'normal'},
  {'id': 'demo-4', 'category': 'An ninh khẩn cấp', 'status': 'pending', 'urgency': 'emergency'},
  {'id': 'demo-5', 'category': 'Trộm cắp', 'status': 'confirmed_true', 'urgency': 'normal'},
  {'id': 'demo-6', 'category': 'Khác', 'status': 'pending', 'urgency': 'normal'},
];

Map<String, dynamic> _demoDetailFor(String id) {
  final base = _demoReportPool.firstWhere((r) => r['id'] == id);
  return {
    ...base,
    'description': 'Tin báo demo — nội dung minh hoạ cho "${base['category']}".',
    'location': {'lat': 12.68, 'lng': 108.05},
    'user': {'id': 'u-$id', 'anonymous': id != 'demo-5', 'fullName': '[DEMO] Người báo tin', 'phoneNumber': '0900000000'},
    'attachments': <Map<String, dynamic>>[],
  };
}

/// Ticks every 15s so the Reports tab visibly gains one more incoming report over time.
final _demoTickProvider = StreamProvider<int>((ref) => Stream.periodic(const Duration(seconds: 15), (i) => i));

class _FakeCameraRepository extends CameraRepository {
  _FakeCameraRepository(super.apiClient);

  @override
  Future<List<Map<String, dynamic>>> nearbyCameras(String reportId, {int radiusM = 500}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return [
      {
        'id': 'cam-1',
        'name': '[DEMO] Camera ngã tư Lê Duẩn',
        'managingUnitName': 'Công an phường Buôn Ma Thuột',
        'managingUnitContact': '0900000001',
        'distanceMeters': 180,
      },
    ];
  }

  @override
  Future<void> createExtractionRequest(
    String reportId, {
    required List<String> cameraIds,
    required DateTime timeRangeStart,
    required DateTime timeRangeEnd,
    String? note,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
  }
}

void main() {
  runApp(
    ProviderScope(
      overrides: [
        districtOptionsProvider.overrideWith(
          (ref) async => [
            {'id': 'd1', 'tenXa': 'Buôn Ma Thuột'},
            {'id': 'd2', 'tenXa': 'Buôn Hồ'},
            {'id': 'd3', 'tenXa': 'Cư M’gar'},
            {'id': 'd4', 'tenXa': 'Cư Pơng'},
          ],
        ),
        overviewProvider.overrideWith(
          (ref) async {
            await Future<void>.delayed(const Duration(milliseconds: 400));
            return {
              'totalReports': 47,
              'byStatus': {'pending': 9, 'verifying': 6, 'confirmed_true': 28, 'confirmed_false': 4},
              'byUrgency': {'emergency': 7, 'normal': 40},
              'avgResponseTimeSeconds': 342.0,
            };
          },
        ),
        responseTimeByDistrictProvider.overrideWith(
          (ref) async {
            await Future<void>.delayed(const Duration(milliseconds: 600));
            return [
              {'districtId': 'd2', 'districtName': 'Buôn Hồ', 'avgResponseTimeSeconds': 520.0, 'reportCount': 8},
              {'districtId': 'd1', 'districtName': 'Buôn Ma Thuột', 'avgResponseTimeSeconds': 410.0, 'reportCount': 22},
              {'districtId': 'd4', 'districtName': 'Cư Pơng', 'avgResponseTimeSeconds': 260.0, 'reportCount': 6},
              {'districtId': 'd3', 'districtName': 'Cư M’gar', 'avgResponseTimeSeconds': 180.0, 'reportCount': 11},
            ];
          },
        ),
        responseTimeByOfficerProvider.overrideWith(
          (ref) async {
            await Future<void>.delayed(const Duration(milliseconds: 500));
            return [
              {
                'officerId': 'o1',
                'officerName': '[DEMO] Trần Thị B',
                'unitName': 'Công an phường Buôn Hồ',
                'avgResponseTimeSeconds': 520.0,
                'reportCount': 8,
              },
              {
                'officerId': 'o2',
                'officerName': '[DEMO] Nguyễn Văn A',
                'unitName': 'Công an phường Buôn Ma Thuột',
                'avgResponseTimeSeconds': 410.0,
                'reportCount': 22,
              },
              {
                'officerId': 'o3',
                'officerName': '[DEMO] Phạm Thị D',
                'unitName': 'Công an xã Cư Pơng',
                'avgResponseTimeSeconds': 260.0,
                'reportCount': 6,
              },
              {
                'officerId': 'o4',
                'officerName': '[DEMO] Lê Văn C',
                'unitName': 'Công an xã Cư M’gar',
                'avgResponseTimeSeconds': 180.0,
                'reportCount': 11,
              },
            ];
          },
        ),
        volumeTrendProvider.overrideWith(
          (ref) async {
            await Future<void>.delayed(const Duration(milliseconds: 450));
            final now = DateTime.now();
            const counts = [3, 5, 2, 6, 4, 7, 5, 8, 3, 6, 9, 4, 7, 5];
            return [
              for (var i = 0; i < counts.length; i++)
                {
                  'date': now.subtract(Duration(days: counts.length - 1 - i)).toIso8601String().substring(0, 10),
                  'count': counts[i],
                },
            ];
          },
        ),
        cameraQueueProvider.overrideWith(
          (ref) async {
            await Future<void>.delayed(const Duration(milliseconds: 350));
            return {'pending': 3, 'sent': 2, 'fulfilled': 5, 'rejected': 1};
          },
        ),
        cameraRepositoryProvider.overrideWithValue(
          _FakeCameraRepository(ApiClient(tokenStore: SecureTokenStore())),
        ),
        reportListProvider.overrideWith((ref) async {
          final tick = ref.watch(_demoTickProvider).valueOrNull ?? 0;
          await Future<void>.delayed(const Duration(milliseconds: 300));
          final visibleCount = (2 + tick).clamp(0, _demoReportPool.length);
          final now = DateTime.now();
          return [
            for (var i = 0; i < visibleCount; i++)
              {..._demoReportPool[i], 'createdAt': now.subtract(Duration(minutes: i * 7)).toIso8601String()},
          ];
        }),
        for (final report in _demoReportPool)
          reportDetailProvider(report['id']!).overrideWith((ref) async {
            await Future<void>.delayed(const Duration(milliseconds: 250));
            return _demoDetailFor(report['id']!);
          }),
      ],
      child: const _DemoApp(),
    ),
  );
}

/// Theme construction (GoogleFonts.*TextTheme, which touches the asset bundle) must happen
/// inside build() — i.e. after runApp() has initialized the binding — not as an argument
/// expression evaluated while constructing the runApp() call itself. Inlining
/// MaterialApp(theme: DashboardTheme.light(), ...) directly under runApp() got this wrong
/// and crashed with "Binding has not yet been initialized"; app.dart's real entry point
/// already gets this right by being a StatelessWidget, so this demo now mirrors it.
class _DemoApp extends StatelessWidget {
  const _DemoApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Báo Tin — Trung tâm điều hành (demo)',
      debugShowCheckedModeBanner: false,
      theme: DashboardTheme.light(),
      darkTheme: DashboardTheme.dark(),
      home: const DashboardScreen(),
    );
  }
}
