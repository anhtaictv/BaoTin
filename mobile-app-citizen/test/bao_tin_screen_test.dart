import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_citizen/core/api_client.dart';
import 'package:bao_tin_citizen/core/providers.dart';
import 'package:bao_tin_citizen/core/secure_token_store.dart';
import 'package:bao_tin_citizen/features/report/bao_tin_screen.dart';
import 'package:bao_tin_citizen/features/report/report_repository.dart';

class _FakeReportRepository extends ReportRepository {
  _FakeReportRepository(super.apiClient, this._suggestion);

  final String? _suggestion;
  final List<String> suggestCalls = [];

  @override
  Future<String?> suggestCategory(String description) async {
    suggestCalls.add(description);
    return _suggestion;
  }
}

Future<_FakeReportRepository> _pump(WidgetTester tester, {String? suggestion}) async {
  final fakeRepo = _FakeReportRepository(ApiClient(tokenStore: SecureTokenStore()), suggestion);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [reportRepositoryProvider.overrideWithValue(fakeRepo)],
      child: const MaterialApp(home: BaoTinScreen()),
    ),
  );
  await tester.pump();
  return fakeRepo;
}

void main() {
  testWidgets('auto-selects the AI-suggested category after the description debounce, with a visible AI hint', (
    tester,
  ) async {
    final fakeRepo = await _pump(tester, suggestion: 'chay_no');

    await tester.enterText(find.byType(TextField), 'Có khói và lửa bốc lên từ nhà kho gần chợ');
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump();

    expect(fakeRepo.suggestCalls, isNotEmpty);
    final chayNoChip = tester.widget<ChoiceChip>(
      find.ancestor(of: find.text('Cháy nổ'), matching: find.byType(ChoiceChip)),
    );
    expect(chayNoChip.selected, isTrue);
    expect(find.textContaining('Đã gợi ý dựa trên mô tả (AI)'), findsOneWidget);
  });

  testWidgets('does not overwrite a category the user picked manually', (tester) async {
    final fakeRepo = await _pump(tester, suggestion: 'chay_no');

    await tester.tap(find.text('Trộm cắp'));
    await tester.pump();

    await tester.enterText(find.byType(TextField), 'Có khói và lửa bốc lên từ nhà kho gần chợ');
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump();

    expect(fakeRepo.suggestCalls, isEmpty);
    final tromCapChip = tester.widget<ChoiceChip>(
      find.ancestor(of: find.text('Trộm cắp'), matching: find.byType(ChoiceChip)),
    );
    expect(tromCapChip.selected, isTrue);
    expect(find.textContaining('Đã gợi ý dựa trên mô tả (AI)'), findsNothing);
  });

  testWidgets('does not change the selection when the suggester returns null', (tester) async {
    await _pump(tester, suggestion: null);

    await tester.enterText(find.byType(TextField), 'Có khói và lửa bốc lên từ nhà kho gần chợ');
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump();

    final defaultChip = tester.widget<ChoiceChip>(
      find.ancestor(of: find.text('Trộm cắp'), matching: find.byType(ChoiceChip)),
    );
    expect(defaultChip.selected, isTrue);
    expect(find.textContaining('Đã gợi ý dựa trên mô tả (AI)'), findsNothing);
  });

  testWidgets('does not call the suggester for very short descriptions', (tester) async {
    final fakeRepo = await _pump(tester, suggestion: 'chay_no');

    await tester.enterText(find.byType(TextField), 'cháy');
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump();

    expect(fakeRepo.suggestCalls, isEmpty);
  });
}
