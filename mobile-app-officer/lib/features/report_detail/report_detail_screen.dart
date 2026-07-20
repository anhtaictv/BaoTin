import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart' as latlong;
import 'package:url_launcher/url_launcher.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../shared/widgets/status_badge.dart';
import '../cameras/nearby_cameras_section.dart';
import '../identity_verification/nfc_cccd_mock_screen.dart';
import 'status_update_action.dart';

class ReportDetailScreen extends ConsumerStatefulWidget {
  const ReportDetailScreen({super.key, required this.reportId});

  final String reportId;

  @override
  ConsumerState<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends ConsumerState<ReportDetailScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(officerReportsRepositoryProvider).getDetail(widget.reportId);
  }

  void _reload() => setState(() {
        _future = ref.read(officerReportsRepositoryProvider).getDetail(widget.reportId);
      });

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Chi tiết tin báo'),
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.description_outlined), text: 'Chi tiết'),
              Tab(icon: Icon(Icons.map_outlined), text: 'Vị trí'),
              Tab(icon: Icon(Icons.fact_check_outlined), text: 'Xử lý'),
            ],
          ),
        ),
        body: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError || snapshot.data == null) {
              return const Center(child: Text('Không tải được chi tiết tin báo.'));
            }
            final report = snapshot.data!;
            return TabBarView(
              children: [
                _DetailsTab(report: report),
                _LocationTab(report: report, reportId: widget.reportId),
                _ProcessingTab(report: report, reportId: widget.reportId, onUpdated: _reload),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// "Ai báo, báo gì, hình ảnh ra sao" — reporter identity (respecting anonymity gating the
/// backend already enforces), category/description, and the attached photos.
class _DetailsTab extends StatelessWidget {
  const _DetailsTab({required this.report});

  final Map<String, dynamic> report;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final attachments = List<Map<String, dynamic>>.from(report['attachments'] as List? ?? []);
    final user = report['user'] as Map<String, dynamic>?;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            UrgencyBadge(urgency: report['urgency'] as String? ?? 'normal'),
            if ((report['urgency'] as String?) == 'emergency') const SizedBox(width: 8),
            StatusBadge(status: report['status'] as String? ?? 'pending'),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Icon(categoryIcon(report['category'] as String?), size: 22, color: colors.primary),
            const SizedBox(width: 8),
            Text(
              categoryLabel(report['category'] as String?),
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ],
        ),
        if ((report['description'] as String?)?.isNotEmpty == true) ...[
          const SizedBox(height: 8),
          Text(report['description'] as String),
        ],
        const SizedBox(height: 20),
        Text('Người báo tin', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (user != null) _ReporterCard(user: user) else const Text('Không có thông tin.'),
        const SizedBox(height: 20),
        Text('Hình ảnh đính kèm', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (attachments.isEmpty)
          Container(
            height: 100,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text('Không có ảnh đính kèm.', style: TextStyle(color: colors.onSurfaceVariant)),
          )
        else
          SizedBox(
            height: 120,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: attachments.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final url = attachments[index]['fileUrl'] as String?;
                if (url == null) return const SizedBox.shrink();
                return InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => _openFullPhoto(context, url),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(url, width: 120, height: 120, fit: BoxFit.cover),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  void _openFullPhoto(BuildContext context, String url) {
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: InteractiveViewer(child: Image.network(url, fit: BoxFit.contain)),
      ),
    );
  }
}

class _ReporterCard extends StatelessWidget {
  const _ReporterCard({required this.user});

  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final anonymous = user['anonymous'] == true;
    final phoneNumber = user['phoneNumber'] as String?;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(child: Icon(anonymous ? Icons.shield_outlined : Icons.person_outline)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    anonymous ? 'Ẩn danh (được bảo vệ)' : (user['fullName'] as String? ?? 'Không rõ tên'),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                if (!anonymous && phoneNumber != null)
                  IconButton(
                    tooltip: 'Gọi $phoneNumber',
                    icon: const Icon(Icons.call),
                    onPressed: () => launchUrl(Uri(scheme: 'tel', path: phoneNumber)),
                  ),
              ],
            ),
            if (!anonymous && phoneNumber != null) ...[
              const SizedBox(height: 4),
              Text(phoneNumber, style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 10),
            OutlinedButton.icon(
              icon: const Icon(Icons.nfc, size: 18),
              label: const Text('Quét CCCD xác minh danh tính (mô phỏng)'),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NfcCccdMockScreen()),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Chỉ trên map là ở vị trí nào" — an embedded OpenStreetMap pin (same flutter_map choice as
/// mobile-app-citizen's area_safety_screen, no paid Google Maps API key needed) plus a button
/// to open the point in the device's own maps app for turn-by-turn directions.
class _LocationTab extends StatelessWidget {
  const _LocationTab({required this.report, required this.reportId});

  final Map<String, dynamic> report;
  final String reportId;

  @override
  Widget build(BuildContext context) {
    final location = report['location'] as Map<String, dynamic>?;
    if (location == null) {
      return const Center(child: Text('Tin báo này không có vị trí.'));
    }
    final lat = (location['lat'] as num).toDouble();
    final lng = (location['lng'] as num).toDouble();
    final point = latlong.LatLng(lat, lng);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: 240,
            child: FlutterMap(
              options: MapOptions(initialCenter: point, initialZoom: 16),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'vn.baotin.officer',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: point,
                      width: 36,
                      height: 36,
                      child: const Icon(Icons.location_on, color: Color(0xFFD32F2F), size: 36),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          icon: const Icon(Icons.directions_outlined),
          label: const Text('Mở bằng Google Maps / ứng dụng bản đồ'),
          onPressed: () => launchUrl(
            Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng'),
            mode: LaunchMode.externalApplication,
          ),
        ),
        const SizedBox(height: 20),
        NearbyCamerasSection(reportId: reportId),
      ],
    );
  }
}

/// "Báo tình trạng rồi liên hệ như thế nào" — current status + the human-in-the-loop action
/// to change it (StatusUpdateAction, unchanged), grouped separately from the read-only details.
class _ProcessingTab extends StatelessWidget {
  const _ProcessingTab({required this.report, required this.reportId, required this.onUpdated});

  final Map<String, dynamic> report;
  final String reportId;
  final VoidCallback onUpdated;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Text('Trạng thái hiện tại', style: Theme.of(context).textTheme.titleSmall),
                const Spacer(),
                StatusBadge(status: report['status'] as String? ?? 'pending'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        StatusUpdateAction(reportId: reportId, onUpdated: onUpdated),
      ],
    );
  }
}
