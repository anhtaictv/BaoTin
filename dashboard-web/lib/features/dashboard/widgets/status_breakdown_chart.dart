import 'package:flutter/material.dart';
import '../../../core/theme.dart';

const _statusOrder = ['pending', 'verifying', 'confirmed_true', 'confirmed_false'];

/// Proportion of a whole (4 statuses) → a single stacked horizontal bar rather than a
/// pie/donut (dataviz anti-patterns: prefer bar for ≥4 categories with precise values;
/// ui-ux-pro-max: "no-pie-overuse"). Colors are the *status* palette shared with both
/// mobile apps (statusColor/statusLabel in theme.dart) — status colors are reserved and
/// never reused for anything else, always paired with a text label, never color alone.
class StatusBreakdownChart extends StatelessWidget {
  const StatusBreakdownChart({super.key, required this.byStatus});

  /// e.g. {pending: 3, verifying: 5, confirmed_true: 10, confirmed_false: 2}
  final Map<String, dynamic> byStatus;

  @override
  Widget build(BuildContext context) {
    final total = _statusOrder.fold<int>(0, (sum, key) => sum + ((byStatus[key] as num?)?.toInt() ?? 0));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(DashboardTheme.cardPadding + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Phân bổ trạng thái', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            if (total == 0)
              Text('Chưa có tin báo nào.', style: Theme.of(context).textTheme.bodySmall)
            else ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: SizedBox(
                  height: 20,
                  child: Row(
                    children: [
                      for (final key in _statusOrder)
                        if (((byStatus[key] as num?)?.toInt() ?? 0) > 0)
                          Expanded(
                            flex: (byStatus[key] as num).toInt(),
                            child: Tooltip(
                              message: '${statusLabel(key)}: ${byStatus[key]}',
                              child: Container(color: statusColor(key)),
                            ),
                          ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  for (final key in _statusOrder)
                    _LegendItem(
                      color: statusColor(key),
                      label: statusLabel(key),
                      count: (byStatus[key] as num?)?.toInt() ?? 0,
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.color, required this.label, required this.count});

  final Color color;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text('$label ($count)', style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
