import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_officer/core/api_client.dart';
import 'package:bao_tin_officer/core/providers.dart';
import 'package:bao_tin_officer/core/secure_token_store.dart';
import 'package:bao_tin_officer/features/signals/signal_detail_screen.dart';
import 'package:bao_tin_officer/features/signals/signals_repository.dart';

const _fakeDetail = {
  'id': 's1',
  'sourceName': '[DEMO] Báo Đắk Lắk Online',
  'sourceUrl': 'https://example.com/tin-1',
  'trustLevel': 'verified_press',
  'summary': 'Công an đang xác minh vụ trộm xe máy.',
  'rawSnippet': 'Theo nguồn tin từ công an địa phương...',
  'detectedCategory': 'trom_cap',
  'duplicateOfId': null,
  'heat': {'score': 6, 'level': 'high'},
  'relatedReports': [
    {'id': 'r1', 'category': 'Trộm cắp tài sản', 'status': 'pending', 'urgency': 'normal', 'createdAt': '2026-01-01T08:30:00Z'},
  ],
};

class _FakeSignalsRepository extends SignalsRepository {
  _FakeSignalsRepository(super.apiClient);

  @override
  Future<Map<String, dynamic>> getDetail(String signalId) async => _fakeDetail;
}

void main() {
  testWidgets('shows the heat badge and cross-referenced reports with a "not conclusive" disclaimer', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          signalsRepositoryProvider.overrideWithValue(
            _FakeSignalsRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: SignalDetailScreen(signalId: 's1')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('Nóng (6)'), findsOneWidget);
    expect(find.textContaining('Đối chiếu chéo'), findsOneWidget);
    expect(find.textContaining('không phải kết luận'), findsOneWidget);
    expect(find.text('Trộm cắp tài sản'), findsOneWidget);
  });
}
