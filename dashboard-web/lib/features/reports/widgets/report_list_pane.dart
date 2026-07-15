import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../reports_filters.dart';
import '../reports_providers.dart';

/// Auto-refreshes every 20s (reportListProvider watches a poll tick) so new citizen
/// reports appear without the reviewer needing to press refresh — plus a manual refresh
/// action for "I want it now".
class ReportListPane extends ConsumerWidget {
  const ReportListPane({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(reportsFiltersProvider);
    final reportsAsync = ref.watch(reportListProvider);
    final selectedId = ref.watch(selectedReportIdProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: Text('Tin báo mới', style: Theme.of(context).textTheme.titleMedium),
              ),
              IconButton(
                tooltip: 'Làm mới',
                icon: const Icon(Icons.refresh, size: 20),
                onPressed: () => ref.invalidate(reportListProvider),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              FilterChip(
                label: const Text('Khẩn cấp'),
                selected: filters.urgency == 'emergency',
                onSelected: (v) {
                  ref.read(reportsFiltersProvider.notifier).state =
                      filters.copyWith(urgency: v ? 'emergency' : null, clearUrgency: !v);
                },
              ),
              ...kReportStatusFilters.entries.map((entry) {
                final selected = filters.status == entry.key;
                return ChoiceChip(
                  label: Text(entry.value),
                  selected: selected,
                  onSelected: (v) {
                    ref.read(reportsFiltersProvider.notifier).state =
                        filters.copyWith(status: v ? entry.key : null, clearStatus: !v);
                  },
                );
              }),
            ],
          ),
        ),
        const Divider(height: 16),
        Expanded(
          child: reportsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, __) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Không tải được danh sách.'),
                  TextButton(onPressed: () => ref.invalidate(reportListProvider), child: const Text('Thử lại')),
                ],
              ),
            ),
            data: (reports) {
              if (reports.isEmpty) {
                return const Center(child: Text('Không có tin báo nào.'));
              }
              return ListView.separated(
                itemCount: reports.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final report = reports[index];
                  final id = report['id'] as String;
                  final isSelected = id == selectedId;
                  return ListTile(
                    selected: isSelected,
                    selectedTileColor: DashboardTheme.primary.withValues(alpha: 0.06),
                    leading: report['urgency'] == 'emergency'
                        ? Icon(Icons.warning_amber_rounded, color: urgencyColor('emergency'))
                        : const SizedBox(width: 24),
                    title: Text(report['category'] as String? ?? 'Khác'),
                    subtitle: Text(_formatDate(report['createdAt'] as String?)),
                    trailing: _StatusDot(status: report['status'] as String? ?? 'pending'),
                    onTap: () => ref.read(selectedReportIdProvider.notifier).state = id,
                  );
                },
              );
            },
          ),
        ),
      ],
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
