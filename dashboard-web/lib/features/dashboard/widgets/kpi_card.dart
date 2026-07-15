import 'package:flutter/material.dart';
import '../../../core/theme.dart';

/// Single-number KPI → stat tile, not a chart (dataviz skill choosing-a-form: "a single
/// headline... sometimes the answer is *not a chart*"). [value] uses the tabular
/// Fira Code display style from DashboardTheme so numbers never jitter columns as they
/// update.
class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.accentColor,
  });

  final String label;
  final String value;
  final IconData? icon;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final color = accentColor ?? DashboardTheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(DashboardTheme.cardPadding + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16, color: color),
                  const SizedBox(width: 6),
                ],
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.displaySmall),
          ],
        ),
      ),
    );
  }
}

/// Shown in place of a KpiCard/chart while its provider loads — a placeholder frame,
/// never a blank empty box (ui-ux-pro-max "loading-chart": skeleton, not empty axis frame).
class ChartCardSkeleton extends StatelessWidget {
  const ChartCardSkeleton({super.key, this.height = 220});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: SizedBox(
        height: height,
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
    );
  }
}

/// Shown on a failed fetch — always with a retry action (ui-ux-pro-max "error-state-chart").
class ChartCardError extends StatelessWidget {
  const ChartCardError({super.key, required this.onRetry, this.height = 220});

  final VoidCallback onRetry;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: SizedBox(
        height: height,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 8),
              const Text('Không tải được dữ liệu.'),
              TextButton(onPressed: onRetry, child: const Text('Thử lại')),
            ],
          ),
        ),
      ),
    );
  }
}
