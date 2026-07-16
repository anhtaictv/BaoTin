import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:bao_tin_dashboard/features/cameras/extraction_request_dialog.dart';

void main() {
  testWidgets('collects a start/end time range and returns it, disabled until both are set', (tester) async {
    ExtractionRequestResult? result;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await showExtractionRequestDialog(context, cameraName: 'Camera ngã tư A');
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Yêu cầu trích xuất — Camera ngã tư A'), findsOneWidget);
    // Nothing picked yet — submit is disabled.
    final submitButton = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Gửi yêu cầu'));
    expect(submitButton.onPressed, isNull);

    await tester.tap(find.text('Huỷ'));
    await tester.pumpAndSettle();
    expect(result, isNull);
  });
}
