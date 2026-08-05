import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_officer/core/api_client.dart';
import 'package:bao_tin_officer/core/providers.dart';
import 'package:bao_tin_officer/core/secure_token_store.dart';
import 'package:bao_tin_officer/features/broadcast_alert/broadcast_alert_repository.dart';
import 'package:bao_tin_officer/features/broadcast_alert/broadcast_alert_screen.dart';

class _FakeBroadcastAlertRepository extends BroadcastAlertRepository {
  _FakeBroadcastAlertRepository(super.apiClient, this._districts);

  final List<Map<String, dynamic>> _districts;
  final List<Map<String, String>> sentCalls = [];

  @override
  Future<List<Map<String, dynamic>>> listDistricts() async => _districts;

  @override
  Future<void> send({required String districtId, required String message, required String urgency}) async {
    sentCalls.add({'districtId': districtId, 'message': message, 'urgency': urgency});
  }
}

/// Pushes BroadcastAlertScreen on top of a placeholder route (not passed as MaterialApp.home
/// directly) so its own Navigator.pop() on success has somewhere real to pop back to.
Future<void> _pumpPushed(WidgetTester tester, BroadcastAlertRepository repo) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [broadcastAlertRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const BroadcastAlertScreen()),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('single assigned district — shows it as plain text, sends with that districtId on submit',
      (tester) async {
    final repo = _FakeBroadcastAlertRepository(
      ApiClient(tokenStore: SecureTokenStore()),
      [
        {'id': 'd1', 'tenXa': 'Phường Tân Định'},
      ],
    );
    await _pumpPushed(tester, repo);

    expect(find.text('Phường Tân Định'), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);

    await tester.enterText(find.byType(TextField), 'Cướp giật gần chợ trung tâm.');
    await tester.tap(find.text('Khẩn cấp'));
    await tester.tap(find.text('Gửi cảnh báo'));
    await tester.pumpAndSettle();

    expect(repo.sentCalls, [
      {'districtId': 'd1', 'message': 'Cướp giật gần chợ trung tâm.', 'urgency': 'emergency'},
    ]);
  });

  testWidgets('multiple assigned districts — shows a picker instead of auto-selecting', (tester) async {
    final repo = _FakeBroadcastAlertRepository(
      ApiClient(tokenStore: SecureTokenStore()),
      [
        {'id': 'd1', 'tenXa': 'Phường Tân Định'},
        {'id': 'd2', 'tenXa': 'Phường Ea Tam'},
      ],
    );
    await _pumpPushed(tester, repo);

    expect(find.byType(DropdownButtonFormField<String>), findsOneWidget);
  });

  testWidgets('shows a validation error instead of sending when the message is empty', (tester) async {
    final repo = _FakeBroadcastAlertRepository(
      ApiClient(tokenStore: SecureTokenStore()),
      [
        {'id': 'd1', 'tenXa': 'Phường Tân Định'},
      ],
    );
    await _pumpPushed(tester, repo);

    await tester.tap(find.text('Gửi cảnh báo'));
    await tester.pumpAndSettle();

    expect(find.text('Hãy nhập nội dung cảnh báo.'), findsOneWidget);
    expect(repo.sentCalls, isEmpty);
  });
}
