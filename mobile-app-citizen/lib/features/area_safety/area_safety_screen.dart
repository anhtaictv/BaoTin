import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart' as latlong;
import 'package:url_launcher/url_launcher.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

/// "Bản đồ cảnh báo khu vực" + "Danh bạ khẩn cấp theo vị trí" (Giai đoạn 3) — một màn hình,
/// hai phần: bản đồ mật độ tin báo tổng hợp theo xã/phường (không có marker cho từng tin
/// báo cụ thể — chỉ điểm trung tâm mỗi xã/phường tô màu theo mức cảnh báo), và danh bạ khẩn
/// cấp tự động theo vị trí hiện tại (bấm gọi trực tiếp).
class AreaSafetyScreen extends ConsumerStatefulWidget {
  const AreaSafetyScreen({super.key});

  @override
  ConsumerState<AreaSafetyScreen> createState() => _AreaSafetyScreenState();
}

class _AreaSafetyScreenState extends ConsumerState<AreaSafetyScreen> {
  late Future<_AreaSafetyData?> _future;
  // ponytail: Flutter Web reports the wrong viewport size on the very first frame, so
  // mounting FlutterMap immediately makes it compute+fetch its tile grid twice (once for the
  // bogus size, once after the real resize). Gating it behind the first post-frame callback
  // means it only ever mounts once layout has already settled — halves the OSM tile requests.
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _mapReady = true);
    });
  }

  Future<_AreaSafetyData?> _load() async {
    final location = await ref.read(locationResolverProvider).resolveFromDevice();
    if (location == null) return null;

    final repo = ref.read(areaSafetyRepositoryProvider);
    final results = await Future.wait([
      repo.getAreaAlerts(lat: location.lat, lng: location.lng),
      repo.getEmergencyContacts(lat: location.lat, lng: location.lng),
    ]);
    return _AreaSafetyData(
      myLat: location.lat,
      myLng: location.lng,
      areaAlerts: results[0] as Map<String, dynamic>,
      contacts: List<Map<String, dynamic>>.from(results[1] as List),
    );
  }

  void _retry() => setState(() => _future = _load());

  Future<void> _call(String phoneNumber) async {
    await launchUrl(Uri(scheme: 'tel', path: phoneNumber));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Khu vực')),
      body: FutureBuilder<_AreaSafetyData?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Không lấy được vị trí hiện tại.'),
                  const SizedBox(height: 8),
                  const Text('Vui lòng bật định vị và cấp quyền truy cập vị trí.', style: TextStyle(fontSize: 12)),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _retry, child: const Text('Thử lại')),
                ],
              ),
            );
          }

          final data = snapshot.data!;
          final districts = List<Map<String, dynamic>>.from(data.areaAlerts['districts'] as List? ?? []);
          final recentBroadcasts =
              List<Map<String, dynamic>>.from(data.areaAlerts['recentBroadcasts'] as List? ?? []);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (recentBroadcasts.isNotEmpty) ...[
                Text('Cảnh báo mới', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'Từ cán bộ phụ trách địa bàn của bạn, trong 48 giờ gần nhất.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                for (final b in recentBroadcasts) _BroadcastAlertCard(broadcast: b),
                const SizedBox(height: 24),
              ],
              Text('Bản đồ cảnh báo khu vực', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                'Số liệu tổng hợp theo xã/phường trong 30 ngày gần nhất — không hiển thị vị trí hay '
                'chi tiết từng tin báo cụ thể.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  height: 260,
                  child: !_mapReady
                      ? const SizedBox()
                      : FlutterMap(
                    options: MapOptions(
                      initialCenter: latlong.LatLng(data.myLat, data.myLng),
                      initialZoom: 11,
                    ),
                    children: [
                      // Public OSM tile server — fine for demo traffic, but OSM's usage
                      // policy (operations.osmfoundation.org/policies/tiles) expects real
                      // production deployments to run a self-hosted tile server or a
                      // commercial provider instead of hammering the free public one.
                      TileLayer(
                        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'vn.baotin.citizen',
                      ),
                      MarkerLayer(
                        markers: [
                          for (final d in districts)
                            Marker(
                              point: latlong.LatLng(
                                (d['centroidLat'] as num).toDouble(),
                                (d['centroidLng'] as num).toDouble(),
                              ),
                              width: 20,
                              height: 20,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: alertLevelColor(d['alertLevel'] as String? ?? 'low'),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                              ),
                            ),
                          Marker(
                            point: latlong.LatLng(data.myLat, data.myLng),
                            width: 26,
                            height: 26,
                            child: const Icon(Icons.person_pin_circle, color: Colors.blue, size: 26),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Wrap(
                spacing: 12,
                children: [
                  _LegendDot(color: Color(0xFF2E7D32), label: 'Ít tin'),
                  _LegendDot(color: Color(0xFFF9A825), label: 'Trung bình'),
                  _LegendDot(color: Color(0xFFD32F2F), label: 'Nhiều tin'),
                ],
              ),
              const SizedBox(height: 24),
              Text('Danh bạ khẩn cấp', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              for (final c in data.contacts)
                Card(
                  child: ListTile(
                    leading: Icon(_iconForContactType(c['contactType'] as String?)),
                    title: Text(c['name'] as String? ?? ''),
                    subtitle: Text(c['phoneNumber'] as String? ?? ''),
                    trailing: IconButton(
                      icon: const Icon(Icons.call),
                      onPressed: () => _call(c['phoneNumber'] as String),
                    ),
                    onTap: () => _call(c['phoneNumber'] as String),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

IconData _iconForContactType(String? type) {
  switch (type) {
    case 'medical':
      return Icons.local_hospital_outlined;
    case 'fire':
      return Icons.local_fire_department_outlined;
    case 'police':
    default:
      return Icons.local_police_outlined;
  }
}

/// Geo-fence alert từ cán bộ phụ trách địa bàn (GET /area-alerts's `recentBroadcasts`) —
/// tách hẳn khỏi statusColor/alertLevelColor (CLAUDE.md #1 tinh thần: nguồn khác nhau, không
/// dùng chung bảng màu) bằng cách tô nền đỏ nhạt riêng cho mức khẩn cấp thay vì tái dùng
/// alertLevelColor's "high".
class _BroadcastAlertCard extends StatelessWidget {
  const _BroadcastAlertCard({required this.broadcast});

  final Map<String, dynamic> broadcast;

  @override
  Widget build(BuildContext context) {
    final isEmergency = (broadcast['urgency'] as String?) == 'emergency';
    return Card(
      color: isEmergency ? const Color(0xFFFFEBEE) : null,
      child: ListTile(
        leading: Icon(
          Icons.campaign_outlined,
          color: isEmergency ? const Color(0xFFD32F2F) : Colors.grey.shade700,
        ),
        title: Text(broadcast['message'] as String? ?? ''),
        subtitle: Text(_formatBroadcastTime(broadcast['createdAt'] as String?)),
      ),
    );
  }
}

String _formatBroadcastTime(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _AreaSafetyData {
  const _AreaSafetyData({
    required this.myLat,
    required this.myLng,
    required this.areaAlerts,
    required this.contacts,
  });

  final double myLat;
  final double myLng;
  final Map<String, dynamic> areaAlerts;
  final List<Map<String, dynamic>> contacts;
}
