import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  @override
  void initState() {
    super.initState();
    _future = _load();
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

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
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
                  child: FlutterMap(
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
