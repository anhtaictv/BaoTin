import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
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
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết tin báo')),
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
          final attachments = List<Map<String, dynamic>>.from(report['attachments'] as List? ?? []);
          final user = report['user'] as Map<String, dynamic>?;
          final location = report['location'] as Map<String, dynamic>?;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  UrgencyBadge(urgency: report['urgency'] as String? ?? 'normal'),
                  const SizedBox(width: 8),
                  StatusBadge(status: report['status'] as String? ?? 'pending'),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                report['category'] as String? ?? 'Khác',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              if ((report['description'] as String?)?.isNotEmpty == true) ...[
                const SizedBox(height: 8),
                Text(report['description'] as String),
              ],
              const SizedBox(height: 16),
              if (location != null)
                _InfoRow(
                  icon: Icons.location_on_outlined,
                  label: 'Vị trí',
                  value: '${location['lat']}, ${location['lng']}',
                ),
              if (user != null) ...[
                _InfoRow(
                  icon: Icons.person_outline,
                  label: 'Người báo tin',
                  value: user['anonymous'] == true
                      ? 'Ẩn danh (được bảo vệ)'
                      : '${user['fullName'] ?? 'Không rõ tên'} — ${user['phoneNumber'] ?? ''}',
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.nfc, size: 18),
                    label: const Text('Quét CCCD xác minh danh tính (mô phỏng)'),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const NfcCccdMockScreen()),
                    ),
                  ),
                ),
              ],
              if (attachments.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Hình ảnh đính kèm', style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 8),
                SizedBox(
                  height: 120,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: attachments.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final url = attachments[index]['fileUrl'] as String?;
                      if (url == null) return const SizedBox.shrink();
                      return ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.network(url, width: 120, height: 120, fit: BoxFit.cover),
                      );
                    },
                  ),
                ),
              ],
              const SizedBox(height: 16),
              NearbyCamerasSection(reportId: widget.reportId),
              const SizedBox(height: 24),
              StatusUpdateAction(reportId: widget.reportId, onUpdated: _reload),
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
