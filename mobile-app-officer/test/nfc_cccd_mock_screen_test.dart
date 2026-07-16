import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_officer/features/identity_verification/nfc_cccd_mock_screen.dart';

void main() {
  testWidgets('shows a scanning state then clearly-labeled mock fields, never claiming to read a real chip',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: NfcCccdMockScreen()));

    expect(find.textContaining('Đang mô phỏng quét NFC'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.pump(const Duration(seconds: 2));
    await tester.pump();

    expect(find.textContaining('chưa đọc chip CCCD thật'), findsOneWidget);
    expect(find.text('[MOCK] Nguyễn Văn A'), findsOneWidget);
    expect(find.text('Xác nhận đã đối chiếu danh tính'), findsOneWidget);
  });
}
