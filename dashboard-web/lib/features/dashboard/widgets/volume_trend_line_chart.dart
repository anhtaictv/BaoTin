import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';

/// Time axis + trend → line chart (dataviz choosing-a-form). Single series, so no legend
/// box is needed (the card title names it) — dataviz §6 "a single series needs no legend".
class VolumeTrendLineChart extends StatelessWidget {
  const VolumeTrendLineChart({super.key, required this.points});

  /// {date: 'YYYY-MM-DD', count: int}
  final List<Map<String, dynamic>> points;

  @override
  Widget build(BuildContext context) {
    if (points.length < 2) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(DashboardTheme.cardPadding + 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Xu hướng số tin theo ngày', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 40),
              Center(
                child: Text(
                  'Chưa đủ dữ liệu để hiển thị xu hướng.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      );
    }

    final spots = <FlSpot>[
      for (var i = 0; i < points.length; i++) FlSpot(i.toDouble(), (points[i]['count'] as num).toDouble()),
    ];
    final maxCount = spots.map((s) => s.y).fold<double>(0, (a, b) => a > b ? a : b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(DashboardTheme.cardPadding + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Xu hướng số tin theo ngày', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            SizedBox(
              height: 220,
              child: LineChart(
                LineChartData(
                  minY: 0,
                  maxY: maxCount <= 0 ? 5 : maxCount * 1.2,
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipItems: (spots) => spots.map((s) {
                        final date = points[s.x.toInt()]['date'] as String;
                        return LineTooltipItem(
                          '$date\n${s.y.toInt()} tin',
                          const TextStyle(color: Colors.white, fontSize: 12),
                        );
                      }).toList(),
                    ),
                  ),
                  titlesData: FlTitlesData(
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 32,
                        getTitlesWidget: (value, meta) =>
                            Text(value.toInt().toString(), style: Theme.of(context).textTheme.bodySmall),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 28,
                        interval: (points.length / 5).clamp(1, points.length).toDouble(),
                        getTitlesWidget: (value, meta) {
                          final index = value.toInt();
                          if (index < 0 || index >= points.length) return const SizedBox.shrink();
                          final date = DateTime.tryParse(points[index]['date'] as String);
                          final label = date == null ? '' : DateFormat('dd/MM').format(date);
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
                          );
                        },
                      ),
                    ),
                  ),
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    getDrawingHorizontalLine: (value) => const FlLine(color: DashboardTheme.borderLight, strokeWidth: 1),
                  ),
                  borderData: FlBorderData(show: false),
                  lineBarsData: [
                    LineChartBarData(
                      spots: spots,
                      isCurved: false,
                      color: DashboardTheme.primary,
                      barWidth: 2,
                      dotData: const FlDotData(show: true),
                      belowBarData: BarAreaData(show: true, color: DashboardTheme.primary.withValues(alpha: 0.12)),
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
