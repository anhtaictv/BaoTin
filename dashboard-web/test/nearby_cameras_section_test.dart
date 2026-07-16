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
}
