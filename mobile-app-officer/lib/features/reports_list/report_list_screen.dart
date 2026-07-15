import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../shared/widgets/status_badge.dart';
import '../report_detail/report_detail_screen.dart';

const _statusFilters = <String, String>{
  'pending': 'Chờ xử lý',
  'verifying': 'Đang xác minh',
  'confirmed_true': 'Đúng sự thật',
  'confirmed_false': 'Tin sai',
};

/// Reports arrive already priority-sorted by the server (emergency first, then oldest —
/// see backend priority.service.ts) — this screen never re-sorts client-side, so it can
/// never disagree with what the officer app is supposed to triage first.
class ReportListScreen extends ConsumerStatefulWidget {
  const ReportListScreen({super.key});

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

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(officerReportsRepositoryProvider).listReports(
          status: _statusFilter,
          urgency: _emergencyOnly ? 'emergency' : null,
        );
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tin báo theo địa bàn')),
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
                ..._statusFilters.entries.map((entry) {
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
                    return ListView(
                      children: const [SizedBox(height: 120), Center(child: Text('Không có tin báo nào.'))],
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: reports.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final report = reports[index];
                      return Card(
                        child: ListTile(
                          leading: UrgencyBadge(urgency: report['urgency'] as String? ?? 'normal'),
                          title: Text(report['category'] as String? ?? 'Khác'),
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
