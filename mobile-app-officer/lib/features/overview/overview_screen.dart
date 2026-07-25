import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../shared/widgets/status_badge.dart';
import '../auth/officer_auth_gate.dart';
import '../report_detail/report_detail_screen.dart';
import '../reports_list/report_list_screen.dart';
import '../signals/signal_list_screen.dart';

/// Landing tab: a quick read of the officer's current workload before diving into the full
/// list. Counts come from GET /officer/reports/overview-stats — a server-side aggregate
/// (groupBy/count) over the same district-scoped, role-gated report set the "Tin báo" tab
/// uses, not a full report fetch counted client-side (that undercounts once a district has
/// more reports than a single page — see officerReports.service.ts's getOwnOverview).
class OverviewScreen extends ConsumerStatefulWidget {
  const OverviewScreen({super.key});

  @override
  ConsumerState<OverviewScreen> createState() => _OverviewScreenState();
}

class _OverviewScreenState extends ConsumerState<OverviewScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(officerReportsRepositoryProvider).getOverviewStats();
  }

  void _refresh() => setState(() {
        _future = ref.read(officerReportsRepositoryProvider).getOverviewStats();
      });

  Future<void> _logout() async {
    await ref.read(officerAuthRepositoryProvider).logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const OfficerAuthGate()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tổng quan'),
        actions: [
          IconButton(
            tooltip: 'Tin nhanh (tham khảo)',
            icon: const Icon(Icons.feed_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SignalListScreen()),
            ),
          ),
          IconButton(
            tooltip: 'Đăng xuất',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await _future;
        },
        child: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                children: const [SizedBox(height: 120), Center(child: Text('Không tải được dữ liệu.'))],
              );
            }
            final stats = snapshot.data ?? const {};
            final total = stats['total'] as int? ?? 0;
            final byStatus = Map<String, dynamic>.from(stats['byStatus'] as Map? ?? {});
            final pending = (byStatus['pending'] as num?)?.toInt() ?? 0;
            final verifying = (byStatus['verifying'] as num?)?.toInt() ?? 0;
            final confirmedTrue = (byStatus['confirmed_true'] as num?)?.toInt() ?? 0;
            final confirmedFalse = (byStatus['confirmed_false'] as num?)?.toInt() ?? 0;
            final emergency = stats['emergencyCount'] as int? ?? 0;
            final needsAttention = List<Map<String, dynamic>>.from(stats['needsAttention'] as List? ?? []);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Tổng số tin báo', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text('$total', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 16),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 2.3,
                  children: [
                    _StatTile(
                      label: 'Khẩn cấp',
                      value: emergency,
                      background: colors.errorContainer,
                      foreground: colors.onErrorContainer,
                      icon: Icons.emergency_outlined,
                    ),
                    _StatTile(
                      label: 'Chờ xử lý',
                      value: pending,
                      background: colors.primaryContainer,
                      foreground: colors.onPrimaryContainer,
                      icon: Icons.pending_actions_outlined,
                    ),
                    _StatTile(
                      label: 'Đang xác minh',
                      value: verifying,
                      background: colors.tertiaryContainer,
                      foreground: colors.onTertiaryContainer,
                      icon: Icons.search_outlined,
                    ),
                    _StatTile(
                      label: 'Đã xác minh',
                      value: confirmedTrue + confirmedFalse,
                      background: colors.surfaceContainerHighest,
                      foreground: colors.onSurfaceVariant,
                      icon: Icons.fact_check_outlined,
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text('Cần chú ý', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                if (needsAttention.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      'Không có tin nào đang chờ xử lý hoặc xác minh.',
                      style: TextStyle(color: colors.onSurfaceVariant),
                    ),
                  )
                else
                  for (final report in needsAttention)
                    Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: colors.primaryContainer,
                          child: Icon(
                            categoryIcon(report['category'] as String?),
                            color: colors.onPrimaryContainer,
                            size: 20,
                          ),
                        ),
                        title: Text(categoryLabel(report['category'] as String?)),
                        subtitle: Text(_formatDate(report['createdAt'] as String?)),
                        trailing: StatusBadge(status: report['status'] as String? ?? 'pending'),
                        onTap: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ReportDetailScreen(reportId: report['id'] as String),
                            ),
                          );
                          _refresh();
                        },
                      ),
                    ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ReportListScreen()),
                  ),
                  icon: const Icon(Icons.list_alt),
                  label: const Text('Xem toàn bộ danh sách tin báo'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.background,
    required this.foreground,
    required this.icon,
  });

  final String label;
  final int value;
  final Color background;
  final Color foreground;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          Icon(icon, color: foreground, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$value', style: TextStyle(color: foreground, fontSize: 20, fontWeight: FontWeight.w700)),
                Text(label, style: TextStyle(color: foreground, fontSize: 12)),
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
