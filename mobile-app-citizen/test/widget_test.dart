import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bao_tin_citizen/app.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('App boots and shows a loading indicator while the auth gate resolves', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: BaoTinCitizenApp()));

    // AuthGate's FutureBuilder starts in the loading state before secure-storage
    // resolves (which needs a real platform channel, unavailable in widget tests) —
    // this just confirms the widget tree builds without throwing.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
