import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../core/theme.dart';

/// Ranking/magnitude comparison (avg response time per district or officer) — a bar chart
/// per dataviz's form heuristic ("comparison → bar"). Deliberately ONE hue (primary) for
/// every bar rather than a categorical palette: these bars aren't distinct "identities"
/// competing for attention, they're the same measurement repeated per entity, so a single
/// hue keeps the reader's attention on the values, not on decoding a color key
/// (ui-ux-pro-max chart rule: "Each bar: distinct color... OR grouped: same hue family").
/// Data already arrives worst-first from the backend (see dashboardStats.service.ts).
class ResponseTimeBarChart extends StatelessWidget {
  const ResponseTimeBarChart({
    super.key,
    required this.title,
    required this.entries,
  });

  final String title;
  /// {label, avgResponseTimeSeconds, reportCount}
  final List<Map<String, dynamic>> entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return _EmptyChartCard(title: title);
    }
    // Cap at 10 bars — a control-room glance, not a full data table (see docs table view).
    final shown = entries.take(10).toList();
    final maxSeconds = shown
        .map((e) => (e['avgResponseTimeSeconds'] as num?)?.toDouble() ?? 0)
        .fold<double>(0, (a, b) => a > b ? a : b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(DashboardTheme.cardPadding + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            SizedBox(
              height: 220,
              child: BarChart(
                BarChartData(
                  maxY: maxSeconds <= 0 ? 60 : maxSeconds * 1.2,
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final entry = shown[group.x.toInt()];
                        return BarTooltipItem(
                          '${entry['label']}\n${_formatSeconds(rod.toY)} • ${entry['reportCount']} tin',
                          const TextStyle(color: Colors.white, fontSize: 12),
                        );
                      },
                    ),
                  ),
                  titlesData: FlTitlesData(
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 44,
                        getTitlesWidget: (value, meta) => Text(
                          _formatSeconds(value),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 32,
                        getTitlesWidget: (value, meta) {
                          final index = value.toInt();
                          if (index < 0 || index >= shown.length) return const SizedBox.shrink();
                          final label = shown[index]['label'] as String;
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              label.length > 10 ? '${label.substring(0, 9)}…' : label,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    horizontalInterval: maxSeconds <= 0 ? 15 : null,
                    getDrawingHorizontalLine: (value) => const FlLine(color: DashboardTheme.borderLight, strokeWidth: 1),
                  ),
                  borderData: FlBorderData(show: false),
                  barGroups: [
                    for (var i = 0; i < shown.length; i++)
                      BarChartGroupData(
                        x: i,
                        barRods: [
                          BarChartRodData(
                            toY: (shown[i]['avgResponseTimeSeconds'] as num?)?.toDouble() ?? 0,
                            color: DashboardTheme.primary,
                            width: 18,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _formatSeconds(double seconds) {
  if (seconds >= 60) return '${(seconds / 60).toStringAsFixed(1)}p';
  return '${seconds.round()}s';
}

class _EmptyChartCard extends StatelessWidget {
  const _EmptyChartCard({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(DashboardTheme.cardPadding + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 40),
            Center(
              child: Text('Chưa có dữ liệu trong khoảng thời gian này.', style: Theme.of(context).textTheme.bodySmall),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}
