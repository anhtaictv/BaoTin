import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../shared/widgets/status_badge.dart';
import '../report_detail/report_detail_screen.dart';
import '../signals/signal_list_screen.dart';

const _activeStatusFilters = <String, String>{
  'pending': 'Chờ xử lý',
  'verifying': 'Đang xác minh',
  'confirmed_true': 'Đúng sự thật',
  'confirmed_false': 'Tin sai',
};

// History only ever shows closed reports — the backend's status filter takes one value at a
// time (no OR), so "both closed statuses, nothing selected" is handled client-side in _load().
const _historyStatusFilters = <String, String>{
  'confirmed_true': 'Đúng sự thật',
  'confirmed_false': 'Tin sai',
};

/// Reports arrive already priority-sorted by the server (emergency first, then oldest —
/// see backend priority.service.ts) — this screen never re-sorts client-side, so it can
/// never disagree with what the officer app is supposed to triage first.
class ReportListScreen extends ConsumerStatefulWidget {
  const ReportListScreen({super.key, this.historyMode = false});

  /// Same screen, same list rendering — only the title, status-filter set, and default
  /// query differ. "Lịch sử" is what an officer already resolved; "Tin báo" is the active
  /// queue. Splitting into a separate file would just duplicate the list/empty-state code.
  final bool historyMode;

  @override
  ConsumerState<ReportListScreen> createState() => _ReportListScreenState();
}

class _ReportListScreenState extends ConsumerState<ReportListScreen> {
  String? _statusFilter;
  bool _emergencyOnly = false;
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final repo = ref.read(officerReportsRepositoryProvider);
    final urgency = _emergencyOnly ? 'emergency' : null;
    if (widget.historyMode && _statusFilter == null) {
      final results = await Future.wait([
        repo.listReports(status: 'confirmed_true', urgency: urgency),
        repo.listReports(status: 'confirmed_false', urgency: urgency),
      ]);
      final merged = [...results[0], ...results[1]];
      merged.sort((a, b) => (b['createdAt'] as String).compareTo(a['createdAt'] as String));
      return merged;
    }
    return repo.listReports(status: _statusFilter, urgency: urgency);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    final statusFilters = widget.historyMode ? _historyStatusFilters : _activeStatusFilters;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.historyMode ? 'Lịch sử tin báo' : 'Tin báo theo địa bàn'),
        actions: widget.historyMode
            ? null
            : [
                IconButton(
                  tooltip: 'Tin nhanh (tham khảo)',
                  icon: const Icon(Icons.feed_outlined),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SignalListScreen()),
                  ),
                ),
              ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilterChip(
                  label: const Text('Chỉ khẩn cấp'),
                  selected: _emergencyOnly,
                  onSelected: (v) {
                    setState(() => _emergencyOnly = v);
                    _refresh();
                  },
                ),
                ...statusFilters.entries.map((entry) {
                  final selected = _statusFilter == entry.key;
                  return ChoiceChip(
                    label: Text(entry.value),
                    selected: selected,
                    onSelected: (v) {
                      setState(() => _statusFilter = v ? entry.key : null);
                      _refresh();
                    },
                  );
                }),
              ],
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
                  final reports = snapshot.data ?? const [];
                  if (reports.isEmpty) {
                    final colors = Theme.of(context).colorScheme;
                    return ListView(
                      children: [
                        const SizedBox(height: 100),
                        Icon(Icons.inbox_outlined, size: 40, color: colors.onSurfaceVariant),
                        const SizedBox(height: 12),
                        Center(
                          child: Text(
                            _statusFilter != null || _emergencyOnly
                                ? 'Không có tin báo nào khớp bộ lọc hiện tại.'
                                : widget.historyMode
                                    ? 'Chưa có tin báo nào được xác minh xong.'
                                    : 'Chưa có tin báo nào trong địa bàn của bạn.',
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
                      final category = report['category'] as String?;
                      final colors = Theme.of(context).colorScheme;
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: colors.primaryContainer,
                            child: Icon(categoryIcon(category), color: colors.onPrimaryContainer, size: 20),
                          ),
                          title: Row(
                            children: [
                              if ((report['urgency'] as String?) == 'emergency') ...[
                                Icon(Icons.warning_amber_rounded, size: 16, color: urgencyColor('emergency')),
                                const SizedBox(width: 4),
                              ],
                              Expanded(child: Text(categoryLabel(category), overflow: TextOverflow.ellipsis)),
                            ],
                          ),
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
