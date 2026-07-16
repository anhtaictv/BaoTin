import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../shared/widgets/heat_badge.dart';
import '../../shared/widgets/trust_level_badge.dart';
import 'signal_detail_screen.dart';

const _trustLevelFilters = <String, String>{
  'verified_press': 'Báo chí',
  'unverified_social': 'MXH',
};

/// "Tin nhanh (tham khảo)" — CLAUDE.md non-negotiable #1/#2: a completely separate screen
/// from ReportListScreen, never a tab/filter *within* it. No status chips, no verify action
/// anywhere on this screen or SignalDetailScreen — there is no workflow here that turns a
/// Signal into an official Report; that only ever happens if an officer files a brand new
/// Report themselves after reading one of these for situational awareness.
class SignalListScreen extends ConsumerStatefulWidget {
  const SignalListScreen({super.key});

  @override
  ConsumerState<SignalListScreen> createState() => _SignalListScreenState();
}

class _SignalListScreenState extends ConsumerState<SignalListScreen> {
  String? _trustLevelFilter;
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(signalsRepositoryProvider).listSignals(trustLevel: _trustLevelFilter);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tin nhanh (tham khảo)')),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: Colors.blueGrey.shade50,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text(
              'Tín hiệu từ báo chí/mạng xã hội — chỉ để tham khảo, chưa được xác thực. '
              'Không phải tin dân báo, không tự động trở thành hồ sơ chính thức.',
              style: TextStyle(color: Colors.blueGrey.shade800, fontSize: 12.5),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _trustLevelFilters.entries.map((entry) {
                final selected = _trustLevelFilter == entry.key;
                return ChoiceChip(
                  label: Text(entry.value),
                  selected: selected,
                  onSelected: (v) {
                    setState(() => _trustLevelFilter = v ? entry.key : null);
                    _refresh();
                  },
                );
              }).toList(),
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
                  if (snapshot.hasError) {
                    return ListView(
                      children: [
                        const SizedBox(height: 80),
                        const Center(child: Text('Không tải được tín hiệu.')),
                        Center(child: TextButton(onPressed: _refresh, child: const Text('Thử lại'))),
                      ],
                    );
                  }
                  final signals = snapshot.data ?? const [];
                  if (signals.isEmpty) {
                    return ListView(
                      children: const [SizedBox(height: 120), Center(child: Text('Không có tín hiệu nào.'))],
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: signals.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final signal = signals[index];
                      final heat = signal['heat'] as Map<String, dynamic>?;
                      return Card(
                        child: ListTile(
                          title: Text(
                            signal['summary'] as String? ?? '(Không có tóm tắt)',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${signal['sourceName'] ?? 'Không rõ nguồn'} · ${_formatDate(signal['publishedAt'] as String?)}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (heat != null && heat['level'] != 'low') ...[
                                const SizedBox(width: 6),
                                HeatBadge(level: heat['level'] as String, score: heat['score'] as int),
                              ],
                            ],
                          ),
                          trailing: TrustLevelBadge(trustLevel: signal['trustLevel'] as String? ?? 'unverified_social'),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => SignalDetailScreen(signalId: signal['id'] as String)),
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
    return DateFormat('dd/MM HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
