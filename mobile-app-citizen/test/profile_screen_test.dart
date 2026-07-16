import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_citizen/features/profile/profile_screen.dart';

void main() {
  testWidgets('links CCCD through the mock NFC flow and updates the shown state', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: ProfileScreen()));

    expect(find.text('Chưa liên kết. Liên kết để tin báo của bạn được ưu tiên xem xét hơn.'), findsOneWidget);

    await tester.tap(find.text('Liên kết'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('Đang mô phỏng quét NFC'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    await tester.pump();

    await tester.tap(find.text('Xác nhận liên kết CCCD'));
    await tester.pumpAndSettle();

    expect(find.text('Đã liên kết (mô phỏng) — tăng độ tin cậy tài khoản.'), findsOneWidget);
  });
}
