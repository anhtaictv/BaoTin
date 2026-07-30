import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../shared/widgets/status_badge.dart';
import 'pending_reports_screen.dart';
import 'report_status_screen.dart';

class MyReportsScreen extends ConsumerStatefulWidget {
  const MyReportsScreen({super.key});

  @override
  ConsumerState<MyReportsScreen> createState() => _MyReportsScreenState();
}

class _MyReportsScreenState extends ConsumerState<MyReportsScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  late Future<List<dynamic>> _pendingFuture;

  @override
  void initState() {
    super.initState();
    _future = ref.read(reportRepositoryProvider).listMine();
    _pendingFuture = ref.read(pendingReportsQueueProvider).listPending();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = ref.read(reportRepositoryProvider).listMine();
      _pendingFuture = ref.read(pendingReportsQueueProvider).listPending();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tin đã báo')),
      body: Column(
        children: [
          // "Tin chờ gửi" banner — only shown once there's actually something queued locally
          // (reports that failed to submit for lack of connectivity, see
          // pending_reports_queue.dart), so it never clutters the normal happy-path list.
          FutureBuilder<List<dynamic>>(
            future: _pendingFuture,
            builder: (context, snapshot) {
              final pendingCount = snapshot.data?.length ?? 0;
              if (pendingCount == 0) return const SizedBox.shrink();
              final colors = Theme.of(context).colorScheme;
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Material(
                  color: colors.tertiaryContainer,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const PendingReportsScreen()),
                      );
                      _refresh();
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Icon(Icons.schedule,
                              size: 18, color: colors.onTertiaryContainer),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              '$pendingCount tin báo đang chờ gửi (chưa có mạng)',
                              style:
                                  TextStyle(color: colors.onTertiaryContainer),
                            ),
                          ),
                          Icon(Icons.chevron_right,
                              color: colors.onTertiaryContainer),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final reports = snapshot.data ?? const [];
                  if (reports.isEmpty) {
                    final colors = Theme.of(context).colorScheme;
                    return ListView(
                      children: [
                        const SizedBox(height: 100),
                        Icon(Icons.inbox_outlined,
                            size: 40, color: colors.onSurfaceVariant),
                        const SizedBox(height: 12),
                        Center(
                          child: Text(
                            'Bạn chưa gửi tin báo nào.',
                            style: TextStyle(color: colors.onSurfaceVariant),
                          ),
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: reports.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final report = reports[index];
                      final colors = Theme.of(context).colorScheme;
                      final category = report['category'] as String?;
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: colors.primaryContainer,
                            child: Icon(categoryIcon(category),
                                color: colors.onPrimaryContainer, size: 20),
                          ),
                          title: Text(categoryLabel(category)),
                          subtitle:
                              Text(_formatDate(report['createdAt'] as String?)),
                          trailing: StatusBadge(
                              status: report['status'] as String? ?? 'pending'),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ReportStatusScreen(
                                  reportId: report['id'] as String),
                            ),
                          ),
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
