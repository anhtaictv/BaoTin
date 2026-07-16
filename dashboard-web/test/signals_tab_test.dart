import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_dashboard/features/dashboard/dashboard_providers.dart';
import 'package:bao_tin_dashboard/features/signals/signals_providers.dart';
import 'package:bao_tin_dashboard/features/signals/signals_tab.dart';

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

Map<String, dynamic> _fakeDetail({String? heatNarrative}) => {
  'id': 's1',
  'sourceName': '[DEMO] Báo Đắk Lắk Online',
  'sourceUrl': 'https://example.com/tin-1',
  'trustLevel': 'verified_press',
  'summary': 'Công an đang xác minh vụ trộm xe máy.',
  'rawSnippet': 'Theo nguồn tin từ công an địa phương...',
  'detectedCategory': 'trom_cap',
  'duplicateOfId': null,
  'heat': {'score': 6, 'level': 'high'},
  'heatNarrative': heatNarrative,
  'relatedReports': [
    {'id': 'r1', 'category': 'Trộm cắp tài sản', 'status': 'pending', 'urgency': 'normal', 'createdAt': '2026-01-01T08:30:00Z'},
  ],
};

void main() {
  testWidgets('lists signals with a distinct disclaimer + trust badge, shows detail on selection, no status UI',
      (tester) async {
    tester.view.physicalSize = const Size(1400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          districtOptionsProvider.overrideWith((ref) async => const []),
          signalListProvider.overrideWith((ref) async => _fakeSignals),
          signalDetailProvider('s1').overrideWith((ref) async => _fakeDetail()),
        ],
        child: const MaterialApp(home: Scaffold(body: SignalsTab())),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('chỉ để tham khảo, chưa được xác thực'), findsOneWidget);
    expect(find.textContaining('Công an đang xác minh vụ trộm xe máy'), findsWidgets);
    expect(find.textContaining('Người dân phản ánh nghi có cháy nhỏ'), findsOneWidget);
    expect(find.text('Chọn 1 tín hiệu bên trái để xem chi tiết.'), findsOneWidget);
    // Never any verification vocabulary on this tab (CLAUDE.md #1/#2).
    expect(find.text('Đúng sự thật'), findsNothing);
    expect(find.text('Xác nhận trạng thái'), findsNothing);

    await tester.tap(find.textContaining('Công an đang xác minh vụ trộm xe máy').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Theo nguồn tin từ công an địa phương...'), findsOneWidget);
    expect(find.text('Báo chí'), findsWidgets);
    expect(find.textContaining('Nóng (6)'), findsOneWidget);
    expect(find.textContaining('Đối chiếu chéo'), findsOneWidget);
    expect(find.text('Trộm cắp tài sản'), findsOneWidget);
    expect(find.textContaining('Diễn giải độ nóng'), findsNothing);
  });

  testWidgets('shows the AI heat narrative card labeled as AI/reference-only when present', (tester) async {
    tester.view.physicalSize = const Size(1400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          districtOptionsProvider.overrideWith((ref) async => const []),
          signalListProvider.overrideWith((ref) async => _fakeSignals),
          signalDetailProvider('s1').overrideWith(
            (ref) async => _fakeDetail(heatNarrative: 'Khu vực đang có nhiều tin về trộm cắp xe máy gần đây.'),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: SignalsTab())),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.textContaining('Công an đang xác minh vụ trộm xe máy').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('Diễn giải độ nóng (AI, chỉ tham khảo)'), findsOneWidget);
    expect(find.text('Khu vực đang có nhiều tin về trộm cắp xe máy gần đây.'), findsOneWidget);
  });
}
