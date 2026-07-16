import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import 'signals_providers.dart';
import 'widgets/signal_detail_pane.dart';
import 'widgets/signal_list_pane.dart';

/// "Tin nhanh (tham khảo)" — CLAUDE.md non-negotiable #1/#2: a completely separate tab from
/// ReportsTab, never merged into it. No status-verification UI anywhere in this tab or its
/// detail pane — nothing here can turn a Signal into an official Report.
class SignalsTab extends ConsumerWidget {
  const SignalsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(selectedSignalIdProvider);

    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 900;

        if (isNarrow) {
          if (selectedId == null) {
            return const Card(margin: EdgeInsets.all(8), child: SignalListPane());
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => ref.read(selectedSignalIdProvider.notifier).state = null,
                    icon: const Icon(Icons.arrow_back, size: 18),
                    label: const Text('Danh sách'),
                  ),
                ),
              ),
              Expanded(child: Card(margin: const EdgeInsets.all(8), child: SignalDetailPane(signalId: selectedId))),
            ],
          );
        }

        return Padding(
          padding: const EdgeInsets.all(DashboardTheme.gridGap),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(
                width: 360,
                child: Card(margin: EdgeInsets.zero, child: SignalListPane()),
              ),
              const SizedBox(width: DashboardTheme.gridGap),
              Expanded(
                child: Card(
                  margin: EdgeInsets.zero,
                  child: selectedId == null
                      ? const Center(child: Text('Chọn 1 tín hiệu bên trái để xem chi tiết.'))
                      : SignalDetailPane(signalId: selectedId),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
