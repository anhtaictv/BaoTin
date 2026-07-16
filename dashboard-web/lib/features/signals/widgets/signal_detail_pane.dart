import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../signals_providers.dart';

/// Read-only — no status chips, no "duyệt"/verify action anywhere on this pane
/// (CLAUDE.md #1/#2: a Signal never gets a human-in-the-loop true/false verdict here).
class SignalDetailPane extends ConsumerWidget {
  const SignalDetailPane({super.key, required this.signalId});

  final String signalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(signalDetailProvider(signalId));

    return detailAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Không tải được chi tiết tín hiệu.'),
            TextButton(
              onPressed: () => ref.invalidate(signalDetailProvider(signalId)),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
      data: (signal) {
        final heat = signal['heat'] as Map<String, dynamic>?;
        final relatedReports = List<Map<String, dynamic>>.from(signal['relatedReports'] as List? ?? []);
        return ListView(
          padding: const EdgeInsets.all(16),
          key: ValueKey(signalId),
          children: [
            Row(
              children: [
                _TrustLevelBadge(trustLevel: signal['trustLevel'] as String? ?? 'unverified_social'),
                if (heat != null) ...[
                  const SizedBox(width: 8),
                  _HeatBadge(level: heat['level'] as String, score: heat['score'] as int),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Text(
              signal['summary'] as String? ?? '(Không có tóm tắt)',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            _InfoRow(icon: Icons.source_outlined, label: 'Nguồn', value: signal['sourceName'] as String? ?? 'Không rõ'),
            if ((signal['sourceUrl'] as String?)?.isNotEmpty == true)
              _InfoRow(icon: Icons.link, label: 'Liên kết', value: signal['sourceUrl'] as String),
            if (signal['detectedCategory'] != null)
              _InfoRow(icon: Icons.category_outlined, label: 'Loại vụ việc', value: signal['detectedCategory'] as String),
            if (signal['duplicateOfId'] != null)
              const _InfoRow(
                icon: Icons.copy_all_outlined,
                label: 'Ghi chú',
                value: 'Có thể trùng với 1 tín hiệu khác đã ghi nhận',
              ),
            if ((signal['rawSnippet'] as String?)?.isNotEmpty == true) ...[
              const SizedBox(height: 16),
              Text('Nội dung gốc', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              Text(signal['rawSnippet'] as String),
            ],
            if (relatedReports.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text('Đối chiếu chéo — tin dân báo cùng địa bàn, gần thời điểm', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 4),
              Text(
                'Chỉ mang tính tham khảo, không phải kết luận là cùng một vụ việc.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              for (final report in relatedReports)
                Card(
                  child: ListTile(
                    leading: report['urgency'] == 'emergency'
                        ? Icon(Icons.warning_amber_rounded, color: urgencyColor('emergency'))
                        : null,
                    title: Text(report['category'] as String? ?? 'Khác'),
                    subtitle: Text(_formatDate(report['createdAt'] as String?)),
                    trailing: _StatusDot(status: report['status'] as String? ?? 'pending'),
                  ),
                ),
            ],
          ],
        );
      },
    );
  }
}

class _TrustLevelBadge extends StatelessWidget {
  const _TrustLevelBadge({required this.trustLevel});

  final String trustLevel;

  @override
  Widget build(BuildContext context) {
    final color = trustLevelColor(trustLevel);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(trustLevelLabel(trustLevel), style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                Text(value),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeatBadge extends StatelessWidget {
  const _HeatBadge({required this.level, required this.score});

  final String level;
  final int score;

  @override
  Widget build(BuildContext context) {
    final color = heatLevelColor(level);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.local_fire_department, size: 14, color: color),
          const SizedBox(width: 4),
          Text('${heatLevelLabel(level)} ($score)', style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
        ],
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Text(statusLabel(status), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
