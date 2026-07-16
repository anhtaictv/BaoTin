import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

/// Trợ lý tìm kiếm ngôn ngữ tự nhiên — AI (Ollama, chạy local) chỉ dùng để hiểu câu hỏi
/// thành bộ lọc, KHÔNG bao giờ tự trả lời bằng văn bản riêng: kết quả luôn là danh sách tin
/// báo/tín hiệu thật lấy từ database (searchAssistant.service.ts), và 2 danh sách này luôn
/// tách biệt rõ ràng — không gộp chung Report với Signal (CLAUDE.md #1/#2).
class SearchTab extends ConsumerStatefulWidget {
  const SearchTab({super.key});

  @override
  ConsumerState<SearchTab> createState() => _SearchTabState();
}

class _SearchTabState extends ConsumerState<SearchTab> {
  final _controller = TextEditingController();
  Future<Map<String, dynamic>>? _future;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _runSearch() {
    final query = _controller.text.trim();
    if (query.isEmpty) return;
    setState(() {
      _future = ref.read(searchRepositoryProvider).search(query);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Tìm kiếm bằng ngôn ngữ tự nhiên (AI cục bộ)', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            'Ví dụ: "tin cháy nổ ở Buôn Ma Thuột tháng trước". AI chỉ hiểu câu hỏi thành bộ lọc — '
            'kết quả luôn là dữ liệu thật, không phải câu trả lời do AI tự tạo ra.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  decoration: const InputDecoration(
                    hintText: 'Nhập câu hỏi...',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => _runSearch(),
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: _runSearch,
                icon: const Icon(Icons.search),
                label: const Text('Tìm kiếm'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Expanded(child: _buildResults(context)),
        ],
      ),
    );
  }

  Widget _buildResults(BuildContext context) {
    final future = _future;
    if (future == null) {
      return const Center(child: Text('Nhập câu hỏi và bấm Tìm kiếm.'));
    }
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError || snapshot.data == null) {
          return const Center(child: Text('Không thực hiện được tìm kiếm. Vui lòng thử lại.'));
        }
        final data = snapshot.data!;
        final available = data['available'] as bool? ?? false;
        if (!available) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Không hiểu được câu hỏi này (hoặc tính năng AI cục bộ chưa được cấu hình — '
                'cần LLM_PROVIDER=ollama ở backend). Hãy thử diễn đạt khác hoặc dùng tab '
                '"Tin báo"/"Tin nhanh" để lọc thủ công.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        }

        final interpreted = data['interpreted'] as Map<String, dynamic>?;
        final reports = List<Map<String, dynamic>>.from(data['reports'] as List? ?? []);
        final signals = List<Map<String, dynamic>>.from(data['signals'] as List? ?? []);

        return ListView(
          children: [
            if (interpreted != null) _InterpretedChips(interpreted: interpreted),
            const SizedBox(height: 16),
            Text('Tin báo (${reports.length})', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            if (reports.isEmpty)
              const Text('Không có tin báo phù hợp.')
            else
              for (final report in reports)
                Card(
                  child: ListTile(
                    leading: report['urgency'] == 'emergency'
                        ? Icon(Icons.warning_amber_rounded, color: urgencyColor('emergency'))
                        : null,
                    title: Text(report['category'] as String? ?? 'Khác'),
                    subtitle: Text(_formatDate(report['createdAt'] as String?)),
                    trailing: _StatusDot(status: report['status'] as String? ?? 'pending'),
                  ),
                ),
            const SizedBox(height: 24),
            Text('Tín hiệu MXH/báo chí — chưa xác thực (${signals.length})', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            if (signals.isEmpty)
              const Text('Không có tín hiệu phù hợp.')
            else
              for (final signal in signals)
                Card(
                  child: ListTile(
                    title: Text(signal['summary'] as String? ?? '(Không có tóm tắt)'),
                    subtitle: Text(signal['sourceName'] as String? ?? 'Không rõ nguồn'),
                    trailing: _TrustLevelBadge(trustLevel: signal['trustLevel'] as String? ?? 'unverified_social'),
                  ),
                ),
          ],
        );
      },
    );
  }
}

class _InterpretedChips extends StatelessWidget {
  const _InterpretedChips({required this.interpreted});

  final Map<String, dynamic> interpreted;

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[];
    if (interpreted['districtName'] != null) {
      chips.add(Chip(label: Text('Địa bàn: ${interpreted['districtName']}')));
    }
    if (interpreted['sinceDays'] != null) {
      chips.add(Chip(label: Text('${interpreted['sinceDays']} ngày gần đây')));
    }
    if (interpreted['keyword'] != null) {
      chips.add(Chip(label: Text('Từ khóa: ${interpreted['keyword']}')));
    }
    if (chips.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Text(statusLabel(status), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

class _TrustLevelBadge extends StatelessWidget {
  const _TrustLevelBadge({required this.trustLevel});

  final String trustLevel;

  @override
  Widget build(BuildContext context) {
    final color = trustLevelColor(trustLevel);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(trustLevelLabel(trustLevel), style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }
}

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
