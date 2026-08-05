import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../shared/widgets/status_badge.dart';
import '../broadcast_alert/broadcast_alert_screen.dart';
import '../report_detail/report_detail_screen.dart';
import '../signals/signal_list_screen.dart';

const _activeStatusFilters = <String, String>{
  'pending': 'Chờ xử lý',
  'verifying': 'Đang xác minh',
  'confirmed_true': 'Đúng sự thật',
  'confirmed_false': 'Tin sai',
};

// History only ever shows closed reports — the backend's status filter takes one value at a
// time (no OR), so "both closed statuses, nothing selected" is handled client-side in _fetchPage().
const _historyStatusFilters = <String, String>{
  'confirmed_true': 'Đúng sự thật',
  'confirmed_false': 'Tin sai',
};

class _FetchResult {
  _FetchResult({required this.reports, required this.hasMore});
  final List<Map<String, dynamic>> reports;
  final bool hasMore;
}

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
  final _scrollController = ScrollController();

  static const _pageSize = 50;
  // ponytail: history mode merges 2 independently-paginated status queries into one sorted
  // list, which doesn't paginate cleanly (page N of confirmed_true and page N of
  // confirmed_false don't line up chronologically once merged) — so it fetches one big page
  // instead of real infinite scroll. Upgrade path if a district's history ever exceeds this:
  // paginate each status query separately and k-way merge instead of one big fetch.
  static const _historyPageSize = 100;

  List<Map<String, dynamic>> _reports = [];
  int _page = 1;
  bool _hasMore = false;
  bool _isLoadingInitial = true;
  bool _isLoadingMore = false;
  bool _hasError = false;

  // Bumped on every _loadInitial (filter change or pull-to-refresh) so a response for a
  // superseded query — reordered by the network, e.g. two filter chips tapped in quick
  // succession — can't overwrite results for the filter that's actually selected now.
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadInitial();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    final canPaginate = !widget.historyMode && _hasMore && !_isLoadingMore && !_isLoadingInitial;
    if (!canPaginate) return;
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<_FetchResult> _fetchPage(int page) async {
    final repo = ref.read(officerReportsRepositoryProvider);
    final urgency = _emergencyOnly ? 'emergency' : null;
    if (widget.historyMode && _statusFilter == null) {
      final results = await Future.wait([
        repo.listReports(status: 'confirmed_true', urgency: urgency, pageSize: _historyPageSize),
        repo.listReports(status: 'confirmed_false', urgency: urgency, pageSize: _historyPageSize),
      ]);
      final merged = [...results[0].reports, ...results[1].reports];
      merged.sort((a, b) => (b['createdAt'] as String).compareTo(a['createdAt'] as String));
      return _FetchResult(reports: merged, hasMore: false);
    }
    final result = await repo.listReports(status: _statusFilter, urgency: urgency, page: page, pageSize: _pageSize);
    return _FetchResult(reports: result.reports, hasMore: result.hasMore);
  }

  Future<void> _loadInitial() async {
    final requestId = ++_requestId;
    setState(() {
      _isLoadingInitial = true;
      _isLoadingMore = false;
      _hasError = false;
    });
    try {
      final result = await _fetchPage(1);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _reports = result.reports;
        _hasMore = result.hasMore;
        _page = 1;
        _isLoadingInitial = false;
      });
    } catch (_) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _hasError = true;
        _isLoadingInitial = false;
      });
    }
  }

  Future<void> _loadMore() async {
    final requestId = _requestId;
    setState(() => _isLoadingMore = true);
    try {
      final nextPage = _page + 1;
      final result = await _fetchPage(nextPage);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _reports = [..._reports, ...result.reports];
        _hasMore = result.hasMore;
        _page = nextPage;
        _isLoadingMore = false;
      });
    } catch (_) {
      // Load-more failing silently keeps the already-loaded list intact — the next scroll
      // tick or pull-to-refresh retries; no need to nag with a SnackBar for a background fetch.
      if (!mounted || requestId != _requestId) return;
      setState(() => _isLoadingMore = false);
    }
  }

  void _refresh() => _loadInitial();

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
                  tooltip: 'Gửi cảnh báo khu vực',
                  icon: const Icon(Icons.campaign_outlined),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const BroadcastAlertScreen()),
                  ),
                ),
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
              onRefresh: _loadInitial,
              child: Builder(
                builder: (context) {
                  if (_isLoadingInitial) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (_hasError) {
                    return ListView(
                      children: const [SizedBox(height: 120), Center(child: Text('Không tải được dữ liệu.'))],
                    );
                  }
                  if (_reports.isEmpty) {
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
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _reports.length + (_isLoadingMore ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      if (index >= _reports.length) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      final report = _reports[index];
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
                          trailing: StatusBadge(
                            status: report['status'] as String? ?? 'pending',
                            isAssigned: report['assignedOfficerId'] != null,
                          ),
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
