import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../reports_providers.dart';

/// CLAUDE.md non-negotiable #3: human-in-the-loop is mandatory — the reviewer must
/// actively pick one of the three statuses below. No default selection, no AI-suggested
/// status, no auto-fill.
class StatusUpdateAction extends ConsumerStatefulWidget {
  const StatusUpdateAction({super.key, required this.reportId});

  final String reportId;

  @override
  ConsumerState<StatusUpdateAction> createState() => _StatusUpdateActionState();
}

class _StatusUpdateActionState extends ConsumerState<StatusUpdateAction> {
  final _noteController = TextEditingController();
  String? _selectedStatus;
  bool _submitting = false;
  String? _error;

  @override
  void didUpdateWidget(covariant StatusUpdateAction oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reportId != widget.reportId) {
      _selectedStatus = null;
      _noteController.clear();
      _error = null;
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedStatus == null) {
      setState(() => _error = 'Hãy chọn một trạng thái xác minh.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(reportsRepositoryProvider).updateStatus(
            widget.reportId,
            _selectedStatus!,
            note: _noteController.text,
          );
      if (!mounted) return;
      ref.invalidate(reportListProvider);
      ref.invalidate(reportDetailProvider(widget.reportId));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã cập nhật trạng thái.')));
      setState(() {
        _selectedStatus = null;
        _noteController.clear();
      });
    } catch (_) {
      setState(() => _error = 'Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Duyệt tin báo', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _statusChip('verifying', 'Đang xác minh'),
                _statusChip('confirmed_true', 'Đúng sự thật'),
                _statusChip('confirmed_false', 'Tin sai'),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteController,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Ghi chú (tuỳ chọn)', alignLabelWithHint: true),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Xác nhận trạng thái'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String value, String label) {
    return ChoiceChip(
      label: Text(label),
      selected: _selectedStatus == value,
      onSelected: (_) => setState(() => _selectedStatus = value),
    );
  }
}
