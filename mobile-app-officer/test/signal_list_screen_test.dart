import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_officer/core/api_client.dart';
import 'package:bao_tin_officer/core/providers.dart';
import 'package:bao_tin_officer/core/secure_token_store.dart';
import 'package:bao_tin_officer/features/signals/signal_list_screen.dart';
import 'package:bao_tin_officer/features/signals/signals_repository.dart';

const _fakeSignals = [
  {
    'id': 's1',
    'sourceName': '[DEMO] Báo Đắk Lắk Online',
    'trustLevel': 'verified_press',
    'summary': 'Công an đang xác minh vụ trộm xe máy.',
    'publishedAt': '2026-01-01T08:00:00Z',
  },
  {
    'id': 's2',
    'sourceName': '[DEMO] Facebook — Hội cư dân',
    'trustLevel': 'unverified_social',
    'summary': 'Người dân phản ánh nghi có cháy nhỏ gần chợ.',
    'publishedAt': '2026-01-01T09:00:00Z',
    'heat': {'score': 6, 'level': 'high'},
  },
];

class _FakeSignalsRepository extends SignalsRepository {
  _FakeSignalsRepository(super.apiClient);

  @override
  Future<List<Map<String, dynamic>>> listSignals({String? trustLevel, String? category}) async {
    if (trustLevel == null) return _fakeSignals;
    return _fakeSignals.where((s) => s['trustLevel'] == trustLevel).toList();
  }
}

void main() {
  testWidgets('shows a distinct disclaimer banner and lists signals with a trust-level badge, no status chips',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          signalsRepositoryProvider.overrideWithValue(
            _FakeSignalsRepository(ApiClient(tokenStore: SecureTokenStore())),
          ),
        ],
        child: const MaterialApp(home: SignalListScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('chỉ để tham khảo, chưa được xác thực'), findsOneWidget);
    expect(find.textContaining('Công an đang xác minh vụ trộm xe máy'), findsOneWidget);
    expect(find.textContaining('Người dân phản ánh nghi có cháy nhỏ'), findsOneWidget);
    expect(find.text('Báo chí'), findsWidgets);
    expect(find.text('MXH — chưa xác thực'), findsOneWidget);
    // No verification-status vocabulary ever appears on this screen (CLAUDE.md #1/#2).
    expect(find.text('Đúng sự thật'), findsNothing);
    expect(find.text('Xác nhận trạng thái'), findsNothing);
    // "low"-heat s1 shows no badge (not worth flagging); "high"-heat s2 does.
    expect(find.textContaining('Nóng (6)'), findsOneWidget);

    await tester.tap(find.text('MXH'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('Công an đang xác minh vụ trộm xe máy'), findsNothing);
    expect(find.textContaining('Người dân phản ánh nghi có cháy nhỏ'), findsOneWidget);
  });
}
