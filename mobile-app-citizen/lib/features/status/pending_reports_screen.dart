import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../report/pending_reports_queue.dart';

/// "Tin chờ gửi" — reports queued locally because they couldn't reach the backend (no
/// connectivity). Mirrors my_reports_screen.dart's list pattern; the one thing it adds is a
/// manual "Gửi lại" action, since the automatic flush only fires on a connectivity-regained
/// event (home_shell.dart) or app foreground, not on a fixed schedule.
class PendingReportsScreen extends ConsumerStatefulWidget {
  const PendingReportsScreen({super.key});

  @override
  ConsumerState<PendingReportsScreen> createState() =>
      _PendingReportsScreenState();
}

class _PendingReportsScreenState extends ConsumerState<PendingReportsScreen> {
  late Future<List<PendingReport>> _future;
  bool _flushing = false;

  @override
  void initState() {
    super.initState();
    _future = ref.read(pendingReportsQueueProvider).listPending();
  }

  Future<void> _reload() async {
    setState(() {
      _future = ref.read(pendingReportsQueueProvider).listPending();
    });
    await _future;
  }

  Future<void> _retryNow() async {
    setState(() => _flushing = true);
    final sent = await ref.read(pendingReportsQueueProvider).flush();
    if (!mounted) return;
    setState(() => _flushing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(sent > 0
              ? 'Đã gửi $sent tin báo.'
              : 'Vẫn chưa gửi được — kiểm tra kết nối mạng.')),
    );
    await _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tin chờ gửi')),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<List<PendingReport>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            final pending = snapshot.data ?? const [];
            if (pending.isEmpty) {
              final colors = Theme.of(context).colorScheme;
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.cloud_done_outlined,
                      size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text(
                      'Không có tin nào đang chờ gửi.',
                      style: TextStyle(color: colors.onSurfaceVariant),
                    ),
                  ),
                ],
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                FilledButton.icon(
                  onPressed: _flushing ? null : _retryNow,
                  icon: _flushing
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.sync),
                  label: Text('Gửi lại ngay (${pending.length})'),
                ),
                const SizedBox(height: 16),
                for (final report in pending) ...[
                  Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor:
                            Theme.of(context).colorScheme.primaryContainer,
                        child: Icon(categoryIcon(report.category),
                            color: Theme.of(context)
                                .colorScheme
                                .onPrimaryContainer,
                            size: 20),
                      ),
                      title: Text(categoryLabel(report.category)),
                      subtitle: Text(
                        'Đang chờ gửi từ ${DateFormat('dd/MM/yyyy HH:mm').format(report.createdAt.toLocal())}',
                      ),
                      trailing: const Icon(Icons.schedule, color: Colors.grey),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
