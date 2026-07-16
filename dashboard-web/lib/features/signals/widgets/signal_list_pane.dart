import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../dashboard/dashboard_providers.dart';
import '../signals_filters.dart';
import '../signals_providers.dart';

class SignalListPane extends ConsumerWidget {
  const SignalListPane({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(signalsFiltersProvider);
    final signalsAsync = ref.watch(signalListProvider);
    final selectedId = ref.watch(selectedSignalIdProvider);
    final districtsAsync = ref.watch(districtOptionsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          color: Colors.deepPurple.shade50,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Text(
            'Tín hiệu từ báo chí/mạng xã hội — chỉ để tham khảo, chưa được xác thực.',
            style: TextStyle(color: Colors.deepPurple.shade800, fontSize: 12),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: Text('Tin nhanh (tham khảo)', style: Theme.of(context).textTheme.titleMedium),
              ),
              IconButton(
                tooltip: 'Làm mới',
                icon: const Icon(Icons.refresh, size: 20),
                onPressed: () => ref.invalidate(signalListProvider),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: kTrustLevelFilters.entries.map((entry) {
              final selected = filters.trustLevel == entry.key;
              return ChoiceChip(
                label: Text(entry.value),
                selected: selected,
                onSelected: (v) {
                  ref.read(signalsFiltersProvider.notifier).state =
                      filters.copyWith(trustLevel: v ? entry.key : null, clearTrustLevel: !v);
                },
              );
            }).toList(),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: districtsAsync.when(
            data: (districts) => DropdownMenu<String?>(
              initialSelection: filters.districtId,
              width: 336,
              menuHeight: 320,
              textStyle: Theme.of(context).textTheme.bodySmall,
              dropdownMenuEntries: [
                const DropdownMenuEntry(value: null, label: 'Tất cả địa bàn'),
                for (final d in districts)
                  DropdownMenuEntry(value: d['id'] as String, label: d['tenXa'] as String),
              ],
              onSelected: (value) {
                ref.read(signalsFiltersProvider.notifier).state =
                    filters.copyWith(districtId: value, clearDistrictId: value == null);
              },
            ),
            loading: () => const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            error: (_, __) => const Text('Không tải được danh sách địa bàn'),
          ),
        ),
        const Divider(height: 16),
        Expanded(
          child: signalsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, __) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Không tải được danh sách.'),
                  TextButton(onPressed: () => ref.invalidate(signalListProvider), child: const Text('Thử lại')),
                ],
              ),
            ),
            data: (signals) {
              if (signals.isEmpty) {
                return const Center(child: Text('Không có tín hiệu nào.'));
              }
              return ListView.separated(
                itemCount: signals.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final signal = signals[index];
                  final id = signal['id'] as String;
                  final isSelected = id == selectedId;
                  return ListTile(
                    selected: isSelected,
                    selectedTileColor: DashboardTheme.primary.withValues(alpha: 0.06),
                    title: Text(
                      signal['summary'] as String? ?? '(Không có tóm tắt)',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${signal['sourceName'] ?? 'Không rõ nguồn'} · ${_formatDate(signal['publishedAt'] as String?)}',
                    ),
                    trailing: _TrustLevelDot(trustLevel: signal['trustLevel'] as String? ?? 'unverified_social'),
                    onTap: () => ref.read(selectedSignalIdProvider.notifier).state = id,
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TrustLevelDot extends StatelessWidget {
  const _TrustLevelDot({required this.trustLevel});

  final String trustLevel;

  @override
  Widget build(BuildContext context) {
    final color = trustLevelColor(trustLevel);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Text(trustLevelLabel(trustLevel), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
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
