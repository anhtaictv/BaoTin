import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';

class TrafficAccidentDetailScreen extends ConsumerStatefulWidget {
  const TrafficAccidentDetailScreen({super.key, required this.alertId});

  final String alertId;

  @override
  ConsumerState<TrafficAccidentDetailScreen> createState() => _TrafficAccidentDetailScreenState();
}

class _TrafficAccidentDetailScreenState extends ConsumerState<TrafficAccidentDetailScreen> {
  late Future<Map<String, dynamic>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = ref.read(trafficAccidentRepositoryProvider).getDetail(widget.alertId);
  }

  Future<void> _decide(Future<void> Function(String) action) async {
    setState(() => _submitting = true);
    try {
      await action(widget.alertId);
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thao tác thất bại. Vui lòng thử lại.')),
      );
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết cảnh báo')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const Center(child: Text('Không tải được chi tiết cảnh báo.'));
          }
          final alert = snapshot.data!;
          final status = alert['status'] as String? ?? 'pending';
          final thumbnailUrl = alert['thumbnailUrl'] as String?;
          final plates = alert['plateNumbers'] as String?;
          final camera = alert['camera'] as Map<String, dynamic>?;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (thumbnailUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    thumbnailUrl,
                    fit: BoxFit.cover,
                    height: 220,
                    width: double.infinity,
                    errorBuilder: (_, __, ___) => Container(
                      height: 220,
                      width: double.infinity,
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      alignment: Alignment.center,
                      child: Icon(Icons.broken_image_outlined, color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              _InfoRow(icon: Icons.pin, label: 'Biển số phát hiện', value: plates?.isNotEmpty == true ? plates! : 'Chưa đọc được'),
              _InfoRow(icon: Icons.videocam_outlined, label: 'Camera', value: camera?['name'] as String? ?? 'Không rõ'),
              _InfoRow(
                icon: Icons.schedule,
                label: 'Thời điểm phát hiện',
                value: _formatDate(alert['detectedAt'] as String?),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Đây là cảnh báo tự động từ camera (phát hiện đối tượng, không nhận diện người) — '
                        'cần cán bộ xác nhận trước khi coi là tai nạn thật.',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              if (status == 'pending') ...[
                FilledButton.icon(
                  onPressed: _submitting
                      ? null
                      : () => _decide((id) => ref.read(trafficAccidentRepositoryProvider).confirm(id)),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Xác nhận là tai nạn'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _submitting
                      ? null
                      : () => _decide((id) => ref.read(trafficAccidentRepositoryProvider).dismiss(id)),
                  icon: const Icon(Icons.cancel_outlined),
                  label: const Text('Không phải tai nạn'),
                ),
              ] else
                Center(
                  child: Text(
                    status == 'confirmed' ? 'Đã xác nhận là tai nạn.' : 'Đã đánh dấu không phải tai nạn.',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: colors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
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
