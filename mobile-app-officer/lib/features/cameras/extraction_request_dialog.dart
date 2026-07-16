import 'package:flutter/material.dart';

class ExtractionRequestResult {
  const ExtractionRequestResult({required this.start, required this.end, this.note});

  final DateTime start;
  final DateTime end;
  final String? note;
}

/// Collects only a time range + note — administrative request details, shared across every
/// camera selected. There is deliberately no way to attach/preview/select video here
/// (CLAUDE.md non-negotiable #8); the actual footage is handled entirely outside this app,
/// separately by each camera's own managing unit — this dialog just describes what to ask
/// for, once, for however many cameras were picked.
Future<ExtractionRequestResult?> showExtractionRequestDialog(
  BuildContext context, {
  required List<String> cameraNames,
}) {
  final title = cameraNames.length == 1
      ? 'Yêu cầu trích xuất — ${cameraNames.first}'
      : 'Yêu cầu trích xuất — ${cameraNames.length} camera';
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
            title: Text(title),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (cameraNames.length > 1) ...[
                  Text(
                    'Mỗi camera sẽ là 1 yêu cầu riêng gửi đúng đơn vị quản lý camera đó: '
                    '${cameraNames.join(", ")}.',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                ],
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
