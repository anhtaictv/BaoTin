import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../shared/widgets/heat_badge.dart';
import '../../shared/widgets/status_badge.dart';
import '../../shared/widgets/trust_level_badge.dart';

/// Read-only — no status chips, no "duyệt"/verify action anywhere on this screen
/// (CLAUDE.md #1/#2: a Signal never gets a human-in-the-loop true/false verdict here,
/// that concept only exists for Reports).
class SignalDetailScreen extends ConsumerStatefulWidget {
  const SignalDetailScreen({super.key, required this.signalId});

  final String signalId;

  @override
  ConsumerState<SignalDetailScreen> createState() => _SignalDetailScreenState();
}

class _SignalDetailScreenState extends ConsumerState<SignalDetailScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(signalsRepositoryProvider).getDetail(widget.signalId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết tín hiệu')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const Center(child: Text('Không tải được chi tiết tín hiệu.'));
          }
          final signal = snapshot.data!;
          final heat = signal['heat'] as Map<String, dynamic>?;
          final relatedReports = List<Map<String, dynamic>>.from(signal['relatedReports'] as List? ?? []);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  TrustLevelBadge(trustLevel: signal['trustLevel'] as String? ?? 'unverified_social'),
                  if (heat != null) ...[
                    const SizedBox(width: 8),
                    HeatBadge(level: heat['level'] as String, score: heat['score'] as int),
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
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
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
                      trailing: StatusBadge(status: report['status'] as String? ?? 'pending'),
                    ),
                  ),
              ],
            ],
          );
        },
      ),
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

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
