import 'package:flutter/material.dart';

class ExtractionRequestResult {
  const ExtractionRequestResult({required this.start, required this.end, this.note});

  final DateTime start;
  final DateTime end;
  final String? note;
}

/// Ported from mobile-app-officer — collects only a time range + note (administrative
/// request), no way to attach/preview video (CLAUDE.md non-negotiable #8).
Future<ExtractionRequestResult?> showExtractionRequestDialog(
  BuildContext context, {
  required String cameraName,
}) {
  DateTime? start;
  DateTime? end;
  final noteController = TextEditingController();

  return showDialog<ExtractionRequestResult>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) {
          Future<void> pickStart() async {
            final picked = await _pickDateTime(context, initial: start ?? DateTime.now());
            if (picked != null) setState(() => start = picked);
          }

          Future<void> pickEnd() async {
            final picked = await _pickDateTime(context, initial: end ?? (start ?? DateTime.now()));
            if (picked != null) setState(() => end = picked);
          }

          final canSubmit = start != null && end != null && end!.isAfter(start!);

          return AlertDialog(
            title: Text('Yêu cầu trích xuất — $cameraName'),
            content: SizedBox(
              width: 360,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Từ thời điểm'),
                    subtitle: Text(start == null ? 'Chưa chọn' : start.toString()),
                    trailing: const Icon(Icons.calendar_today, size: 18),
                    onTap: pickStart,
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Đến thời điểm'),
                    subtitle: Text(end == null ? 'Chưa chọn' : end.toString()),
                    trailing: const Icon(Icons.calendar_today, size: 18),
                    onTap: pickEnd,
                  ),
                  if (start != null && end != null && !end!.isAfter(start!))
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        'Thời điểm kết thúc phải sau thời điểm bắt đầu.',
                        style: TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: noteController,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Ghi chú (tuỳ chọn)'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Huỷ')),
              FilledButton(
                onPressed: canSubmit
                    ? () => Navigator.of(context).pop(
                          ExtractionRequestResult(start: start!, end: end!, note: noteController.text),
                        )
                    : null,
                child: const Text('Gửi yêu cầu'),
              ),
            ],
          );
        },
      );
    },
  );
}

Future<DateTime?> _pickDateTime(BuildContext context, {required DateTime initial}) async {
  final date = await showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: DateTime.now().subtract(const Duration(days: 30)),
    lastDate: DateTime.now(),
  );
  if (date == null || !context.mounted) return null;

  final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial));
  if (time == null) return null;

  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}
