import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart' as latlong;
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../report_detail/report_detail_screen.dart';

const _fallbackCenter = latlong.LatLng(16.0, 108.0); // Vietnam-wide default when nothing has a pin yet.

/// "Địa điểm" tab: every report in the officer's district(s) plotted as one map, pin color =
/// status (same statusColor as everywhere else in this app). Reports without GPS (rare —
/// mobile-app-citizen requires either device location or EXIF GPS to submit, CLAUDE.md #6)
/// are simply left off the map rather than shown at (0,0).
class ReportMapScreen extends ConsumerStatefulWidget {
  const ReportMapScreen({super.key});

  @override
  ConsumerState<ReportMapScreen> createState() => _ReportMapScreenState();
}

class _ReportMapScreenState extends ConsumerState<ReportMapScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  final _mapController = MapController();
  bool _fitted = false;

  // ponytail: a map view inherently wants every pin, but the list endpoint is now paginated
  // (server-side max page_size 100) — a district with more reports than that just won't show
  // its oldest ones on the map yet. Upgrade path if that becomes real: marker clustering +
  // viewport-bounded fetching instead of "load everything", which pagination alone can't fix.
  static const _mapPageSize = 100;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final page = await ref.read(officerReportsRepositoryProvider).listReports(pageSize: _mapPageSize);
    return page.reports;
  }

  void _refresh() => setState(() {
        _future = _load();
        _fitted = false;
      });

  // MapOptions.initialCameraFit only takes effect on the FlutterMap widget's first build —
  // a later refresh with newly-arrived points never re-fits the camera on its own (a real
  // bug found while testing against seeded demo data: 6 pins loaded but the map stayed at
  // the zoom-5 fallback, so every pin overlapped invisibly). Driving MapController.fitCamera
  // explicitly once per completed future fixes it without fighting the user's own pan/zoom.
  void _fitToPoints(List<_ReportPin> points) {
    if (_fitted || points.isEmpty) return;
    _fitted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (points.length == 1) {
        _mapController.move(points.first.point, 13);
      } else {
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: LatLngBounds.fromPoints(points.map((p) => p.point).toList()),
            padding: const EdgeInsets.all(48),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Địa điểm'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _refresh)],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Không tải được dữ liệu.'));
          }
          final reports = snapshot.data ?? const [];
          final points = <_ReportPin>[
            for (final r in reports)
              if (r['location'] != null)
                _ReportPin(
                  report: r,
                  point: latlong.LatLng(
                    ((r['location'] as Map)['lat'] as num).toDouble(),
                    ((r['location'] as Map)['lng'] as num).toDouble(),
                  ),
                ),
          ];
          _fitToPoints(points);

          return Stack(
            children: [
              FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: points.isEmpty ? _fallbackCenter : points.first.point,
                  initialZoom: points.isEmpty ? 5 : 13,
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'vn.baotin.officer',
                  ),
                  MarkerLayer(
                    markers: [
                      for (final pin in points)
                        Marker(
                          point: pin.point,
                          width: 40,
                          height: 40,
                          child: GestureDetector(
                            onTap: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ReportDetailScreen(reportId: pin.report['id'] as String),
                                ),
                              );
                              _refresh();
                            },
                            child: Icon(
                              Icons.location_on,
                              color: statusColor(pin.report['status'] as String? ?? 'pending'),
                              size: 40,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              if (reports.isNotEmpty && points.isEmpty)
                const Positioned(
                  left: 16,
                  right: 16,
                  top: 16,
                  child: _MapNotice(text: 'Chưa có tin báo nào trong địa bàn kèm vị trí GPS.'),
                ),
              Positioned(
                left: 16,
                bottom: 16,
                child: _StatusLegend(),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ReportPin {
  _ReportPin({required this.report, required this.point});

  final Map<String, dynamic> report;
  final latlong.LatLng point;
}

class _MapNotice extends StatelessWidget {
  const _MapNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 8)],
      ),
      child: Text(text, style: TextStyle(color: colors.onSurfaceVariant)),
    );
  }
}

class _StatusLegend extends StatelessWidget {
  static const _entries = <String>['pending', 'verifying', 'confirmed_true', 'confirmed_false'];

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 8)],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final status in _entries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.location_on, color: statusColor(status), size: 16),
                  const SizedBox(width: 6),
                  Text(statusLabel(status), style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
