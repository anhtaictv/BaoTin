import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_dashboard/core/api_client.dart';
import 'package:bao_tin_dashboard/core/providers.dart';
import 'package:bao_tin_dashboard/core/secure_token_store.dart';
import 'package:bao_tin_dashboard/features/cameras/camera_repository.dart';
import 'package:bao_tin_dashboard/features/cameras/nearby_cameras_section.dart';

class _FailingCameraRepository extends CameraRepository {
  _FailingCameraRepository(super.apiClient);

  @override
  Future<List<Map<String, dynamic>>> nearbyCameras(String reportId, {int radiusM = 500}) {
    return Future.error(Exception('network down'));
  }
}

const _cameras = [
  {'id': 'c1', 'name': 'Camera ngã tư 1', 'managingUnitName': 'Công an phường A', 'managingUnitContact': '0900000001', 'distanceMeters': 120},
  {'id': 'c2', 'name': 'Camera ngã tư 2', 'managingUnitName': 'Công an phường B', 'managingUnitContact': '0900000002', 'distanceMeters': 340},
];

class _FakeCameraRepository extends CameraRepository {
  _FakeCameraRepository(super.apiClient);

  final List<Map<String, dynamic>> createCalls = [];

  @override
  Future<List<Map<String, dynamic>>> nearbyCameras(String reportId, {int radiusM = 500}) async => _cameras;

  @override
  Future<void> createExtractionRequest(
    String reportId, {
    required List<String> cameraIds,
    required DateTime timeRangeStart,
    required DateTime timeRangeEnd,
    String? note,
  }) async {
    createCalls.add({'reportId': reportId, 'cameraIds': cameraIds});
  }
}

void main() {
  testWidgets('shows a distinct error + retry state, not the empty-list message', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          cameraRepositoryProvider.overrideWithValue(
            _FailingCameraRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: NearbyCamerasSection(reportId: 'r1'))),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('Không tải được camera gần đây.'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
    expect(find.text('Không có camera nào được ghi nhận gần vị trí này.'), findsNothing);
  });

  testWidgets('supports selecting multiple cameras and opens a consolidated dialog for them', (tester) async {
    final fakeRepo = _FakeCameraRepository(ApiClient(tokenStore: SecureTokenStore()));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [cameraRepositoryProvider.overrideWithValue(fakeRepo)],
        child: const MaterialApp(home: Scaffold(body: NearbyCamerasSection(reportId: 'r1'))),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byType(CheckboxListTile), findsNWidgets(2));
    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull);

    await tester.tap(find.byType(CheckboxListTile).at(0));
    await tester.pump();
    await tester.tap(find.byType(CheckboxListTile).at(1));
    await tester.pump();
    expect(find.text('Xin trích xuất (2)'), findsOneWidget);

    await tester.tap(find.text('Xin trích xuất (2)'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Yêu cầu trích xuất — 2 camera'), findsOneWidget);
    expect(find.textContaining('Mỗi camera sẽ là 1 yêu cầu riêng'), findsOneWidget);

    await tester.tap(find.text('Huỷ'));
    await tester.pumpAndSettle();
    expect(fakeRepo.createCalls, isEmpty);
  });
}
