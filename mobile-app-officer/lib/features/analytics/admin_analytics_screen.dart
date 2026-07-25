import 'package:dio/dio.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart' as latlong;
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../report_detail/report_detail_screen.dart';

const _fallbackCenter = latlong.LatLng(16.0, 108.0);
const _statusOrder = ['pending', 'verifying', 'confirmed_true', 'confirmed_false'];
const _periods = ['day', 'week', 'month'];
const _periodLabels = {'day': 'Ngày', 'week': 'Tuần', 'month': 'Tháng'};
const _categoryColors = [
  Color(0xFF1E40AF),
  Color(0xFFD97706),
  Color(0xFFDC2626),
  Color(0xFF2E7D32),
  Color(0xFF6A1B9A),
  Color(0xFF64748B),
];

/// "Thống kê" tab — admin/senior_officer only (backend requireDashboardRole). Same
/// always-visible-tab-with-403-fallback convention as pending_officers_screen.dart. Mirrors
/// dashboard-web-react's OverviewPage.tsx (same endpoints, same charts) minus PDF export —
/// that's a desktop-report workflow, kept on the web dashboard only.
class AdminAnalyticsScreen extends ConsumerStatefulWidget {
  const AdminAnalyticsScreen({super.key});

  @override
  ConsumerState<AdminAnalyticsScreen> createState() => _AdminAnalyticsScreenState();
}

class _AdminAnalyticsScreenState extends ConsumerState<AdminAnalyticsScreen> {
  int _days = 30;
  String _period = 'day';
  String? _forbiddenMessage;

  Future<Map<String, dynamic>>? _overview;
  Future<List<Map<String, dynamic>>>? _volumeTrend;
  Future<List<Map<String, dynamic>>>? _byCategory;
  Future<List<Map<String, dynamic>>>? _byDistrict;
  Future<List<Map<String, dynamic>>>? _locations;
  final _mapController = MapController();
  bool _fitted = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<T> _guard<T>(Future<T> Function() call, T Function() empty) {
    return call().catchError((Object e) {
      if (e is DioException && e.response?.statusCode == 403) {
        if (mounted) setState(() => _forbiddenMessage = 'Chỉ quản trị viên/cán bộ cấp cao mới xem được thống kê.');
        return empty();
      }
      throw e;
    });
  }

  void _refresh() {
    final repo = ref.read(adminDashboardRepositoryProvider);
    setState(() {
      _forbiddenMessage = null;
      _fitted = false;
      _overview = _guard(() => repo.getOverview(days: _days), () => <String, dynamic>{});
      _volumeTrend = _guard(() => repo.getVolumeTrend(days: _days, period: _period), () => <Map<String, dynamic>>[]);
      _byCategory = _guard(() => repo.getByCategory(days: _days), () => <Map<String, dynamic>>[]);
      _byDistrict = _guard(() => repo.getReportCountByDistrict(days: _days), () => <Map<String, dynamic>>[]);
      _locations = _guard(() => repo.getReportLocations(days: _days), () => <Map<String, dynamic>>[]);
    });
  }

  void _setPeriod(String p) {
    setState(() => _period = p);
    final repo = ref.read(adminDashboardRepositoryProvider);
    setState(() => _volumeTrend = _guard(() => repo.getVolumeTrend(days: _days, period: _period), () => <Map<String, dynamic>>[]));
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thống kê'),
        actions: [
          PopupMenuButton<int>(
            tooltip: 'Khoảng ngày',
            initialValue: _days,
            onSelected: (value) {
              setState(() => _days = value);
              _refresh();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 7, child: Text('7 ngày')),
              PopupMenuItem(value: 30, child: Text('30 ngày')),
              PopupMenuItem(value: 90, child: Text('90 ngày')),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(children: [Text('$_days ngày'), const Icon(Icons.expand_more, size: 18)]),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await Future.wait([_overview!, _volumeTrend!, _byCategory!, _byDistrict!, _locations!]);
        },
        child: _forbiddenMessage != null
            ? ListView(children: [
                const SizedBox(height: 100),
                Icon(Icons.lock_outline, size: 40, color: colors.onSurfaceVariant),
                const SizedBox(height: 12),
                Center(child: Text(_forbiddenMessage!, style: TextStyle(color: colors.onSurfaceVariant))),
              ])
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildKpiRow(colors),
                  const SizedBox(height: 20),
                  _buildStatusPie(colors),
                  const SizedBox(height: 20),
                  _buildVolumeTrend(colors),
                  const SizedBox(height: 20),
                  _buildRankedCard('Phân loại tin báo', _byCategory, (row) => categoryLabel(row['category'] as String?),
                      (row) => (row['count'] as num).toInt()),
                  const SizedBox(height: 20),
                  _buildRankedCard('Số tin theo xã/phường', _byDistrict, (row) => row['districtName'] as String? ?? '',
                      (row) => (row['reportCount'] as num).toInt()),
                  const SizedBox(height: 20),
                  _buildMap(colors),
                ],
              ),
      ),
    );
  }

  Widget _buildKpiRow(ColorScheme colors) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _overview,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const SizedBox(height: 90, child: Center(child: CircularProgressIndicator()));
        }
        final data = snapshot.data ?? const {};
        final byStatus = Map<String, dynamic>.from(data['byStatus'] as Map? ?? {});
        final total = data['totalReports'] as int? ?? 0;
        final pendingVerifying = (byStatus['pending'] as int? ?? 0) + (byStatus['verifying'] as int? ?? 0);
        final confirmedTrue = byStatus['confirmed_true'] as int? ?? 0;
        final avgSeconds = data['avgResponseTimeSeconds'] as num?;
        return GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 2.3,
          children: [
            _KpiTile(label: 'Tổng số tin', value: '$total', background: colors.primaryContainer, foreground: colors.onPrimaryContainer),
            _KpiTile(
                label: 'Chờ / đang xác minh',
                value: '$pendingVerifying',
                background: colors.tertiaryContainer,
                foreground: colors.onTertiaryContainer),
            _KpiTile(
                label: 'Đã xác nhận đúng',
                value: '$confirmedTrue',
                background: colors.surfaceContainerHighest,
                foreground: colors.onSurfaceVariant),
            _KpiTile(
                label: 'Phản hồi TB',
                value: _formatSeconds(avgSeconds),
                background: colors.errorContainer,
                foreground: colors.onErrorContainer),
          ],
        );
      },
    );
  }

  Widget _buildStatusPie(ColorScheme colors) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Phân bổ trạng thái', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            FutureBuilder<Map<String, dynamic>>(
              future: _overview,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const SizedBox(height: 140, child: Center(child: CircularProgressIndicator()));
                }
                final byStatus = Map<String, dynamic>.from((snapshot.data ?? const {})['byStatus'] as Map? ?? {});
                final entries = _statusOrder
                    .map((s) => (status: s, count: (byStatus[s] as num?)?.toInt() ?? 0))
                    .where((e) => e.count > 0)
                    .toList();
                if (entries.isEmpty) {
                  return const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Chưa có tin báo nào.'));
                }
                return Row(
                  children: [
                    SizedBox(
                      width: 120,
                      height: 120,
                      child: PieChart(
                        PieChartData(
                          sectionsSpace: 2,
                          centerSpaceRadius: 30,
                          sections: [
                            for (final e in entries)
                              PieChartSectionData(
                                value: e.count.toDouble(),
                                color: statusColor(e.status),
                                title: '',
                                radius: 26,
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Wrap(
                        spacing: 12,
                        runSpacing: 8,
                        children: [
                          for (final e in entries)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 10,
                                  height: 10,
                                  decoration: BoxDecoration(color: statusColor(e.status), shape: BoxShape.circle),
                                ),
                                const SizedBox(width: 6),
                                Text('${statusLabel(e.status)} (${e.count})', style: const TextStyle(fontSize: 12)),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVolumeTrend(ColorScheme colors) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Xu hướng số tin', style: TextStyle(fontWeight: FontWeight.w700)),
                Row(
                  children: [
                    for (final p in _periods)
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: ChoiceChip(
                          label: Text(_periodLabels[p]!, style: const TextStyle(fontSize: 11)),
                          selected: _period == p,
                          onSelected: (_) => _setPeriod(p),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _volumeTrend,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const SizedBox(height: 120, child: Center(child: CircularProgressIndicator()));
                }
                final rows = snapshot.data ?? const [];
                if (rows.isEmpty) {
                  return const SizedBox(height: 60, child: Center(child: Text('Chưa có dữ liệu.')));
                }
                final maxCount = rows.map((r) => (r['count'] as num).toDouble()).reduce((a, b) => a > b ? a : b);
                return SizedBox(
                  height: 140,
                  child: LineChart(
                    LineChartData(
                      minY: 0,
                      maxY: maxCount == 0 ? 1 : maxCount * 1.15,
                      gridData: const FlGridData(show: true, drawVerticalLine: false, horizontalInterval: 1),
                      titlesData: const FlTitlesData(show: false),
                      borderData: FlBorderData(show: false),
                      lineTouchData: LineTouchData(
                        touchTooltipData: LineTouchTooltipData(
                          getTooltipItems: (spots) => spots
                              .map((s) => LineTooltipItem(
                                  '${_formatBucketDate(rows[s.x.toInt()]['date'] as String)}: ${rows[s.x.toInt()]['count']}',
                                  const TextStyle(color: Colors.white, fontSize: 11)))
                              .toList(),
                        ),
                      ),
                      lineBarsData: [
                        LineChartBarData(
                          spots: [
                            for (var i = 0; i < rows.length; i++)
                              FlSpot(i.toDouble(), (rows[i]['count'] as num).toDouble()),
                          ],
                          isCurved: true,
                          color: BaoTinOfficerTheme.gold,
                          barWidth: 2.5,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(
                            show: true,
                            color: BaoTinOfficerTheme.gold.withValues(alpha: 0.12),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRankedCard(
    String title,
    Future<List<Map<String, dynamic>>>? future,
    String Function(Map<String, dynamic>) labelOf,
    int Function(Map<String, dynamic>) valueOf,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const SizedBox(height: 80, child: Center(child: CircularProgressIndicator()));
                }
                final rows = (snapshot.data ?? const []).take(8).toList();
                if (rows.isEmpty) {
                  return const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Chưa có dữ liệu.'));
                }
                final maxValue = rows.map(valueOf).reduce((a, b) => a > b ? a : b);
                return Column(
                  children: [
                    for (var i = 0; i < rows.length; i++)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 110,
                              child: Text(labelOf(rows[i]), style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis),
                            ),
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: maxValue == 0 ? 0 : valueOf(rows[i]) / maxValue,
                                  minHeight: 14,
                                  backgroundColor: Colors.grey.shade200,
                                  valueColor: AlwaysStoppedAnimation(_categoryColors[i % _categoryColors.length]),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text('${valueOf(rows[i])}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _fitToPoints(List<latlong.LatLng> points) {
    if (_fitted || points.isEmpty) return;
    _fitted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (points.length == 1) {
        _mapController.move(points.first, 12);
      } else {
        _mapController.fitCamera(CameraFit.bounds(bounds: LatLngBounds.fromPoints(points), padding: const EdgeInsets.all(40)));
      }
    });
  }

  Widget _buildMap(ColorScheme colors) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Bản đồ tin báo', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            SizedBox(
              height: 280,
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: _locations,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final rows = snapshot.data ?? const [];
                  final points = rows.map((r) => latlong.LatLng((r['lat'] as num).toDouble(), (r['lng'] as num).toDouble())).toList();
                  _fitToPoints(points);
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: points.isEmpty ? _fallbackCenter : points.first,
                        initialZoom: points.isEmpty ? 5 : 12,
                        interactionOptions: const InteractionOptions(flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag),
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'vn.baotin.officer',
                        ),
                        MarkerLayer(
                          markers: [
                            for (var i = 0; i < rows.length; i++)
                              Marker(
                                point: points[i],
                                width: 32,
                                height: 32,
                                child: GestureDetector(
                                  onTap: () => Navigator.of(context).push(
                                    MaterialPageRoute(builder: (_) => ReportDetailScreen(reportId: rows[i]['id'] as String)),
                                  ),
                                  child: Icon(Icons.location_on, color: statusColor(rows[i]['status'] as String? ?? 'pending'), size: 32),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({required this.label, required this.value, required this.background, required this.foreground});

  final String label;
  final String value;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: TextStyle(color: foreground, fontSize: 20, fontWeight: FontWeight.w700)),
          Text(label, style: TextStyle(color: foreground, fontSize: 12)),
        ],
      ),
    );
  }
}

String _formatSeconds(num? seconds) {
  if (seconds == null) return '—';
  return seconds >= 60 ? '${(seconds / 60).toStringAsFixed(1)}p' : '${seconds.round()}s';
}

String _formatBucketDate(String iso) {
  try {
    return DateFormat('dd/MM').format(DateTime.parse(iso));
  } catch (_) {
    return iso;
  }
}
