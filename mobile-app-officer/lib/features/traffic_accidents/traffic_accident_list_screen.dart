import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import 'traffic_accident_detail_screen.dart';

const _statusFilters = <String, String>{
  'pending': 'Chờ xác nhận',
  'confirmed': 'Đã xác nhận',
  'dismissed': 'Không phải tai nạn',
};

const _statusLabels = _statusFilters;

Color _statusColor(String status) {
  switch (status) {
    case 'confirmed':
      return const Color(0xFFD32F2F);
    case 'dismissed':
      return Colors.grey;
    default:
      return const Color(0xFFF57C00);
  }
}

/// Alerts a paired object-detection worker posts when it sees a likely collision (see
/// backend's TrafficAccidentAlert) — every alert starts `pending`, an officer must
/// explicitly confirm or dismiss it before it means anything (CLAUDE.md #3).
class TrafficAccidentListScreen extends ConsumerStatefulWidget {
  const TrafficAccidentListScreen({super.key});

  @override
  ConsumerState<TrafficAccidentListScreen> createState() => _TrafficAccidentListScreenState();
}

class _TrafficAccidentListScreenState extends ConsumerState<TrafficAccidentListScreen> {
  String? _statusFilter = 'pending';
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(trafficAccidentRepositoryProvider).listAlerts(status: _statusFilter);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cảnh báo tai nạn giao thông')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _statusFilters.entries.map((entry) {
                final selected = _statusFilter == entry.key;
                return ChoiceChip(
                  label: Text(entry.value),
                  selected: selected,
                  onSelected: (v) {
                    setState(() => _statusFilter = v ? entry.key : null);
                    _refresh();
                  },
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                _refresh();
                await _future;
              },
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return ListView(
                      children: const [
                        SizedBox(height: 100),
                        Center(child: Text('Không tải được danh sách cảnh báo.')),
                      ],
                    );
                  }
                  final alerts = snapshot.data ?? const [];
                  if (alerts.isEmpty) {
                    final colors = Theme.of(context).colorScheme;
                    return ListView(
                      children: [
                        const SizedBox(height: 100),
                        Icon(Icons.local_police_outlined, size: 40, color: colors.onSurfaceVariant),
                        const SizedBox(height: 12),
                        Center(
                          child: Text(
                            'Không có cảnh báo nào khớp bộ lọc hiện tại.',
                            style: TextStyle(color: colors.onSurfaceVariant),
                          ),
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: alerts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final alert = alerts[index];
                      final status = alert['status'] as String? ?? 'pending';
                      final plates = alert['plateNumbers'] as String?;
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: _statusColor(status).withValues(alpha: 0.15),
                            child: Icon(Icons.car_crash, color: _statusColor(status), size: 20),
                          ),
                          title: Text(plates?.isNotEmpty == true ? plates! : 'Chưa đọc được biển số'),
                          subtitle: Text(_formatDate(alert['detectedAt'] as String?)),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _statusColor(status).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              _statusLabels[status] ?? status,
                              style: TextStyle(color: _statusColor(status), fontWeight: FontWeight.w600, fontSize: 12),
                            ),
                          ),
                          onTap: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => TrafficAccidentDetailScreen(alertId: alert['id'] as String),
                              ),
                            );
                            _refresh();
                          },
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
