import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_officer/core/api_client.dart';
import 'package:bao_tin_officer/core/providers.dart';
import 'package:bao_tin_officer/core/secure_token_store.dart';
import 'package:bao_tin_officer/features/cameras/camera_repository.dart';
import 'package:bao_tin_officer/features/cameras/nearby_cameras_section.dart';

const _cameras = [
  {'id': 'c1', 'name': 'Camera ngã tư 1', 'managingUnitName': 'Công an phường A', 'managingUnitContact': '0900000001', 'distanceMeters': 120},
  {'id': 'c2', 'name': 'Camera ngã tư 2', 'managingUnitName': 'Công an phường B', 'managingUnitContact': '0900000002', 'distanceMeters': 340},
  {'id': 'c3', 'name': 'Camera chợ', 'managingUnitName': 'Ban quản lý chợ', 'managingUnitContact': '0900000003', 'distanceMeters': 500},
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

Future<_FakeCameraRepository> _pump(WidgetTester tester) async {
  final fakeRepo = _FakeCameraRepository(ApiClient(tokenStore: SecureTokenStore()));
  await tester.pumpWidget(
    ProviderScope(
      overrides: [cameraRepositoryProvider.overrideWithValue(fakeRepo)],
      child: const MaterialApp(home: Scaffold(body: NearbyCamerasSection(reportId: 'r1'))),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
  return fakeRepo;
}

void main() {
  testWidgets('lists nearby cameras with checkboxes, no per-row extraction button', (tester) async {
    await _pump(tester);

    expect(find.text('Camera ngã tư 1'), findsOneWidget);
    expect(find.text('Camera ngã tư 2'), findsOneWidget);
    expect(find.text('Camera chợ'), findsOneWidget);
    expect(find.byType(CheckboxListTile), findsNWidgets(3));
    expect(find.text('Xin trích xuất'), findsOneWidget);
  });

  testWidgets('the submit button is disabled until at least one camera is selected', (tester) async {
    await _pump(tester);

    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull);

    await tester.tap(find.byType(CheckboxListTile).first);
    await tester.pump();

    final buttonAfter = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(buttonAfter.onPressed, isNotNull);
    expect(find.text('Xin trích xuất (1)'), findsOneWidget);
  });

  testWidgets('unchecking a camera removes it from the selection count', (tester) async {
    await _pump(tester);

    await tester.tap(find.byType(CheckboxListTile).at(0));
    await tester.pump();
    await tester.tap(find.byType(CheckboxListTile).at(1));
    await tester.pump();
    expect(find.text('Xin trích xuất (2)'), findsOneWidget);

    await tester.tap(find.byType(CheckboxListTile).at(0));
    await tester.pump();
    expect(find.text('Xin trích xuất (1)'), findsOneWidget);
  });

  testWidgets('opens a consolidated dialog naming every selected camera when 2+ are picked', (tester) async {
    final fakeRepo = await _pump(tester);

    await tester.tap(find.byType(CheckboxListTile).at(0));
    await tester.pump();
    await tester.tap(find.byType(CheckboxListTile).at(2));
    await tester.pump();

    await tester.tap(find.text('Xin trích xuất (2)'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Yêu cầu trích xuất — 2 camera'), findsOneWidget);
    expect(find.textContaining('Mỗi camera sẽ là 1 yêu cầu riêng'), findsOneWidget);
    expect(find.textContaining('Camera ngã tư 1'), findsWidgets);
    expect(find.textContaining('Camera chợ'), findsWidgets);

    // Nothing picked yet — submit is disabled, matching the single-camera dialog's behavior.
    final submitButton = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Gửi yêu cầu'));
    expect(submitButton.onPressed, isNull);

    await tester.tap(find.text('Huỷ'));
    await tester.pumpAndSettle();
    expect(fakeRepo.createCalls, isEmpty);
  });

  testWidgets('opens a plain single-camera dialog title when only one camera is picked', (tester) async {
    await _pump(tester);

    await tester.tap(find.byType(CheckboxListTile).first);
    await tester.pump();
    await tester.tap(find.text('Xin trích xuất (1)'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Yêu cầu trích xuất — Camera ngã tư 1'), findsOneWidget);
    expect(find.textContaining('Mỗi camera sẽ là 1 yêu cầu riêng'), findsNothing);
  });
}
