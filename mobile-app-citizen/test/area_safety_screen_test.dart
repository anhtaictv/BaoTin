import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_citizen/core/api_client.dart';
import 'package:bao_tin_citizen/core/providers.dart';
import 'package:bao_tin_citizen/core/secure_token_store.dart';
import 'package:bao_tin_citizen/features/area_safety/area_safety_repository.dart';
import 'package:bao_tin_citizen/features/area_safety/area_safety_screen.dart';
import 'package:bao_tin_citizen/features/report/camera_gps_capture.dart';

class _FakeLocationResolver extends LocationResolver {
  @override
  Future<ResolvedLocation?> resolveFromDevice() async {
    return const ResolvedLocation(lat: 12.68, lng: 108.05, source: 'device_gps');
  }
}

class _DeniedLocationResolver extends LocationResolver {
  @override
  Future<ResolvedLocation?> resolveFromDevice() async => null;
}

class _FakeAreaSafetyRepository extends AreaSafetyRepository {
  _FakeAreaSafetyRepository(super.apiClient);

  @override
  Future<Map<String, dynamic>> getAreaAlerts({required double lat, required double lng}) async {
    return {
      'myDistrictId': 'd1',
      'districts': [
        {'districtId': 'd1', 'tenXa': 'Buôn Ma Thuột', 'centroidLat': 12.68, 'centroidLng': 108.05, 'reportCount': 1, 'alertLevel': 'low'},
        {'districtId': 'd2', 'tenXa': 'Buôn Hồ', 'centroidLat': 12.91, 'centroidLng': 108.27, 'reportCount': 10, 'alertLevel': 'high'},
      ],
      'recentBroadcasts': [
        {'id': 'b1', 'message': 'Cướp giật gần chợ trung tâm, người dân lưu ý.', 'urgency': 'emergency', 'createdAt': '2026-01-01T10:00:00Z'},
      ],
    };
  }

  @override
  Future<List<Map<String, dynamic>>> getEmergencyContacts({required double lat, required double lng}) async {
    return [
      {'contactType': 'police', 'name': 'Công an (toàn quốc)', 'phoneNumber': '113', 'note': null, 'isLocal': false},
      {'contactType': 'medical', 'name': '[DEMO] Trung tâm y tế Buôn Ma Thuột', 'phoneNumber': '0900000101', 'note': null, 'isLocal': true},
    ];
  }
}

void main() {
  testWidgets('shows the alert map disclaimer and the emergency contact list', (tester) async {
    // The screen's ListView only builds children within the viewport + cache extent — with
    // the broadcast alert section on top of the map/legend/contacts, the default test surface
    // is too short to lazily build the contacts list. A tall viewport is simpler than
    // scrolling assertions into view one by one.
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          locationResolverProvider.overrideWithValue(_FakeLocationResolver()),
          areaSafetyRepositoryProvider.overrideWithValue(
            _FakeAreaSafetyRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: AreaSafetyScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('không hiển thị vị trí hay'), findsOneWidget);
    expect(find.text('Công an (toàn quốc)'), findsOneWidget);
    expect(find.text('113'), findsOneWidget);
    expect(find.text('[DEMO] Trung tâm y tế Buôn Ma Thuột'), findsOneWidget);
    expect(find.text('Cảnh báo mới'), findsOneWidget);
    expect(find.text('Cướp giật gần chợ trung tâm, người dân lưu ý.'), findsOneWidget);
  });

  testWidgets('shows a retry action when the device location is unavailable', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          locationResolverProvider.overrideWithValue(_DeniedLocationResolver()),
          areaSafetyRepositoryProvider.overrideWithValue(
            _FakeAreaSafetyRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: AreaSafetyScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Không lấy được vị trí hiện tại.'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
  });
}
