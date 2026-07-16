import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import 'dashboard_providers.dart';
import 'widgets/camera_queue_tiles.dart';
import 'widgets/filter_bar.dart';
import 'widgets/kpi_card.dart';
import 'widgets/response_time_bar_chart.dart';
import 'widgets/status_breakdown_chart.dart';
import 'widgets/volume_trend_line_chart.dart';

/// Data-Dense Dashboard layout (ui-ux-pro-max style search): filter bar → KPI row →
/// charts grid, 8px gaps, cards fill available width on a 2-column grid at desktop
/// widths and stack to 1 column below ~900px (control-room screens are wide, but the
/// page still degrades gracefully — ui-ux-pro-max "responsive-chart").
class DashboardOverviewTab extends ConsumerWidget {
  const DashboardOverviewTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(overviewProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(DashboardTheme.gridGap * 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const FilterBar(),
          const SizedBox(height: DashboardTheme.gridGap * 2),
          overviewAsync.when(
            data: (overview) => _KpiRow(overview: overview),
            loading: () => const _KpiRowSkeleton(),
            error: (_, __) => ChartCardError(onRetry: () => ref.invalidate(overviewProvider), height: 100),
          ),
          const SizedBox(height: DashboardTheme.gridGap * 2),
          _ResponsiveChartGrid(
            children: [
              _ProviderChart(
                provider: responseTimeByDistrictProvider,
                onRetry: () => ref.invalidate(responseTimeByDistrictProvider),
                builder: (data) => ResponseTimeBarChart(
                  title: 'Thời gian phản hồi TB theo địa bàn',
                  subtitle: 'Luôn hiển thị tất cả địa bàn để so sánh',
                  entries: data
                      .map((d) => {
                            'label': d['districtName'],
                            'avgResponseTimeSeconds': d['avgResponseTimeSeconds'],
                            'reportCount': d['reportCount'],
                          })
                      .toList(),
                ),
              ),
              _ProviderChart(
                provider: responseTimeByOfficerProvider,
                onRetry: () => ref.invalidate(responseTimeByOfficerProvider),
                builder: (data) => ResponseTimeBarChart(
                  title: 'Thời gian phản hồi TB theo cán bộ',
                  entries: data
                      .map((o) => {
                            'label': o['officerName'],
                            'avgResponseTimeSeconds': o['avgResponseTimeSeconds'],
                            'reportCount': o['reportCount'],
                          })
                      .toList(),
                ),
              ),
              _ProviderChart(
                provider: volumeTrendProvider,
                onRetry: () => ref.invalidate(volumeTrendProvider),
                builder: (data) => VolumeTrendLineChart(points: data),
              ),
              overviewAsync.when(
                data: (overview) => StatusBreakdownChart(byStatus: overview['byStatus'] as Map<String, dynamic>),
                loading: () => const ChartCardSkeleton(),
                error: (_, __) => ChartCardError(onRetry: () => ref.invalidate(overviewProvider)),
              ),
            ],
          ),
          const SizedBox(height: DashboardTheme.gridGap * 2),
          ref.watch(cameraQueueProvider).when(
                data: (data) => CameraQueueTiles(byStatus: data),
                loading: () => const ChartCardSkeleton(height: 120),
                error: (_, __) => ChartCardError(onRetry: () => ref.invalidate(cameraQueueProvider), height: 120),
              ),
        ],
      ),
    );
  }
}

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.overview});

  final Map<String, dynamic> overview;

  @override
  Widget build(BuildContext context) {
    final byStatus = overview['byStatus'] as Map<String, dynamic>;
    final avgSeconds = (overview['avgResponseTimeSeconds'] as num?)?.toDouble();
    final avgLabel = avgSeconds == null
        ? '—'
        : avgSeconds >= 60
            ? '${(avgSeconds / 60).toStringAsFixed(1)} phút'
            : '${avgSeconds.round()} giây';

    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 700;
        final cards = [
          KpiCard(label: 'Tổng số tin', value: '${overview['totalReports']}', icon: Icons.summarize_outlined),
          KpiCard(
            label: 'Chờ xử lý / đang xác minh',
            value: '${(byStatus['pending'] ?? 0) + (byStatus['verifying'] ?? 0)}',
            icon: Icons.hourglass_empty,
          ),
          KpiCard(
            label: 'Đã xác nhận đúng',
            value: '${byStatus['confirmed_true'] ?? 0}',
            icon: Icons.check_circle_outline,
            accentColor: statusColor('confirmed_true'),
          ),
          KpiCard(
            label: 'Thời gian phản hồi TB',
            value: avgLabel,
            icon: Icons.speed_outlined,
            accentColor: DashboardTheme.accent,
          ),
        ];
        if (isNarrow) {
          return Column(
            children: [for (final c in cards) Padding(padding: const EdgeInsets.only(bottom: 8), child: c)],
          );
        }
        return Row(
          children: [for (final c in cards) Expanded(child: Padding(padding: const EdgeInsets.only(right: 8), child: c))],
        );
      },
    );
  }
}

class _KpiRowSkeleton extends StatelessWidget {
  const _KpiRowSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(child: Padding(padding: EdgeInsets.only(right: 8), child: ChartCardSkeleton(height: 90))),
        Expanded(child: Padding(padding: EdgeInsets.only(right: 8), child: ChartCardSkeleton(height: 90))),
        Expanded(child: Padding(padding: EdgeInsets.only(right: 8), child: ChartCardSkeleton(height: 90))),
        Expanded(child: ChartCardSkeleton(height: 90)),
      ],
    );
  }
}

/// 2-column at desktop widths, 1-column below ~900px.
class _ResponsiveChartGrid extends StatelessWidget {
  const _ResponsiveChartGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth < 900 ? 1 : 2;
        if (columns == 1) {
          return Column(
            children: [for (final c in children) Padding(padding: const EdgeInsets.only(bottom: 12), child: c)],
          );
        }
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [for (final c in children) SizedBox(width: (constraints.maxWidth - 12) / 2, child: c)],
        );
      },
    );
  }
}

/// Wraps a FutureProvider<List<...>> with the standard loading/error/data states so
/// every chart follows the same pattern (ui-ux-pro-max "loading-chart"/"error-state-chart").
class _ProviderChart extends ConsumerWidget {
  const _ProviderChart({required this.provider, required this.builder, required this.onRetry});

  final ProviderListenable<AsyncValue<List<Map<String, dynamic>>>> provider;
  final Widget Function(List<Map<String, dynamic>> data) builder;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);
    return async.when(
      data: builder,
      loading: () => const ChartCardSkeleton(),
      error: (_, __) => ChartCardError(onRetry: onRetry),
    );
  }
}
