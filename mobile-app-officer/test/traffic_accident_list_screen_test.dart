import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_officer/core/api_client.dart';
import 'package:bao_tin_officer/core/providers.dart';
import 'package:bao_tin_officer/core/secure_token_store.dart';
import 'package:bao_tin_officer/features/traffic_accidents/traffic_accident_list_screen.dart';
import 'package:bao_tin_officer/features/traffic_accidents/traffic_accident_repository.dart';

const _fakeAlerts = [
  {
    'id': 'a1',
    'plateNumbers': '51H-123.45',
    'status': 'pending',
    'detectedAt': '2026-01-01T08:00:00Z',
  },
  {
    'id': 'a2',
    'plateNumbers': null,
    'status': 'confirmed',
    'detectedAt': '2026-01-01T09:00:00Z',
  },
];

class _FakeTrafficAccidentRepository extends TrafficAccidentRepository {
  _FakeTrafficAccidentRepository(super.apiClient);

  @override
  Future<List<Map<String, dynamic>>> listAlerts({String? status}) async {
    if (status == null) return _fakeAlerts;
    return _fakeAlerts.where((a) => a['status'] == status).toList();
  }
}

void main() {
  testWidgets('defaults to pending alerts and lets an officer switch to the confirmed filter', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          trafficAccidentRepositoryProvider.overrideWithValue(
            _FakeTrafficAccidentRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: TrafficAccidentListScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('51H-123.45'), findsOneWidget);
    expect(find.textContaining('Chưa đọc được biển số'), findsNothing);

    await tester.tap(find.text('Đã xác nhận'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('51H-123.45'), findsNothing);
    expect(find.textContaining('Chưa đọc được biển số'), findsOneWidget);
  });
}
