import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme.dart';
import '../../cameras/nearby_cameras_section.dart';
import '../reports_providers.dart';
import 'status_update_action.dart';

class ReportDetailPane extends ConsumerWidget {
  const ReportDetailPane({super.key, required this.reportId});

  final String reportId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(reportDetailProvider(reportId));

    return detailAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Không tải được chi tiết tin báo.'),
            TextButton(
              onPressed: () => ref.invalidate(reportDetailProvider(reportId)),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
      data: (report) {
        final attachments = List<Map<String, dynamic>>.from(report['attachments'] as List? ?? []);
        final user = report['user'] as Map<String, dynamic>?;
        final location = report['location'] as Map<String, dynamic>?;

        return ListView(
          padding: const EdgeInsets.all(16),
          key: ValueKey(reportId),
          children: [
            Row(
              children: [
                _UrgencyBadge(urgency: report['urgency'] as String? ?? 'normal'),
                const SizedBox(width: 8),
                _StatusBadge(
                  status: report['status'] as String? ?? 'pending',
                  isAssigned: report['assignedOfficerId'] != null,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(report['category'] as String? ?? 'Khác', style: Theme.of(context).textTheme.titleLarge),
            if ((report['description'] as String?)?.isNotEmpty == true) ...[
              const SizedBox(height: 8),
              Text(report['description'] as String),
            ],
            const SizedBox(height: 16),
            if (location != null)
              _InfoRow(icon: Icons.location_on_outlined, label: 'Vị trí', value: '${location['lat']}, ${location['lng']}'),
            if (user != null)
              _InfoRow(
                icon: Icons.person_outline,
                label: 'Người báo tin',
                value: user['anonymous'] == true
                    ? 'Ẩn danh (được bảo vệ)'
                    : '${user['fullName'] ?? 'Không rõ tên'} — ${user['phoneNumber'] ?? ''}',
              ),
            if (attachments.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text('Hình ảnh đính kèm', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              SizedBox(
                height: 140,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: attachments.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final url = attachments[index]['fileUrl'] as String?;
                    if (url == null) return const SizedBox.shrink();
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.network(url, width: 140, height: 140, fit: BoxFit.cover),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 16),
            NearbyCamerasSection(reportId: reportId),
            const SizedBox(height: 16),
            StatusUpdateAction(reportId: reportId),
          ],
        );
      },
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, this.isAssigned = false});

  final String status;
  final bool isAssigned;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status, isAssigned: isAssigned);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Text(statusLabel(status, isAssigned: isAssigned), style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }
}

class _UrgencyBadge extends StatelessWidget {
  const _UrgencyBadge({required this.urgency});

  final String urgency;

  @override
  Widget build(BuildContext context) {
    if (urgency != 'emergency') return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: urgencyColor(urgency), borderRadius: BorderRadius.circular(6)),
      child: Text(
        urgencyLabel(urgency),
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                Text(value),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
