import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_dashboard/core/api_client.dart';
import 'package:bao_tin_dashboard/core/providers.dart';
import 'package:bao_tin_dashboard/core/secure_token_store.dart';
import 'package:bao_tin_dashboard/features/search/search_repository.dart';
import 'package:bao_tin_dashboard/features/search/search_tab.dart';

class _FakeSearchRepository extends SearchRepository {
  _FakeSearchRepository(super.apiClient, this._response);

  final Map<String, dynamic> _response;
  final List<String> queries = [];

  @override
  Future<Map<String, dynamic>> search(String query) async {
    queries.add(query);
    return _response;
  }
}

Future<_FakeSearchRepository> _pumpAndSearch(
  WidgetTester tester,
  Map<String, dynamic> response, {
  String query = 'tin cháy nổ ở Buôn Ma Thuột tháng trước',
}) async {
  final fakeRepo = _FakeSearchRepository(ApiClient(tokenStore: SecureTokenStore()), response);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [searchRepositoryProvider.overrideWithValue(fakeRepo)],
      child: const MaterialApp(home: Scaffold(body: SearchTab())),
    ),
  );
  await tester.pump();

  await tester.enterText(find.byType(TextField), query);
  await tester.tap(find.text('Tìm kiếm'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));

  return fakeRepo;
}

void main() {
  testWidgets('shows a prompt before any search is run', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          searchRepositoryProvider.overrideWithValue(
            _FakeSearchRepository(ApiClient(tokenStore: SecureTokenStore()), const {}),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: SearchTab())),
      ),
    );
    await tester.pump();

    expect(find.text('Nhập câu hỏi và bấm Tìm kiếm.'), findsOneWidget);
  });

  testWidgets('shows the unavailable message when available is false', (tester) async {
    await _pumpAndSearch(tester, const {'available': false, 'interpreted': null, 'reports': [], 'signals': []});

    expect(find.textContaining('Không hiểu được câu hỏi này'), findsOneWidget);
  });

  testWidgets('shows interpreted filters and keeps reports/signals in separate sections', (tester) async {
    final fakeRepo = await _pumpAndSearch(
      tester,
      {
        'available': true,
        'interpreted': {'districtName': 'Buôn Ma Thuột', 'sinceDays': 30, 'keyword': 'cháy nổ'},
        'reports': [
          {'id': 'r1', 'category': 'chay_no', 'status': 'pending', 'urgency': 'normal', 'createdAt': '2026-01-01T08:00:00Z'},
        ],
        'signals': [
          {'id': 's1', 'sourceName': 'Báo A', 'summary': 'Cháy nhỏ gần chợ', 'trustLevel': 'verified_press'},
        ],
      },
    );

    expect(fakeRepo.queries, ['tin cháy nổ ở Buôn Ma Thuột tháng trước']);
    expect(find.textContaining('Địa bàn: Buôn Ma Thuột'), findsOneWidget);
    expect(find.textContaining('30 ngày gần đây'), findsOneWidget);
    expect(find.textContaining('Từ khóa: cháy nổ'), findsOneWidget);
    expect(find.textContaining('Tin báo (1)'), findsOneWidget);
    expect(find.textContaining('Tín hiệu MXH/báo chí — chưa xác thực (1)'), findsOneWidget);
    expect(find.text('Cháy nhỏ gần chợ'), findsOneWidget);
  });

  testWidgets('shows empty-state text for each section when there are no matches', (tester) async {
    await _pumpAndSearch(tester, const {
      'available': true,
      'interpreted': {'districtName': null, 'sinceDays': null, 'keyword': null},
      'reports': [],
      'signals': [],
    });

    expect(find.text('Không có tin báo phù hợp.'), findsOneWidget);
    expect(find.text('Không có tín hiệu phù hợp.'), findsOneWidget);
  });
}
