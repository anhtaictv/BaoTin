import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import 'reports_providers.dart';
import 'widgets/report_detail_pane.dart';
import 'widgets/report_list_pane.dart';

/// Master-detail: list on the left (fixed width, fits a control-room-sized screen),
/// detail + duyệt (verify) action on the right. Below ~900px the detail pane opens as a
/// full-width view instead, since a control room is the primary target but the layout
/// still degrades reasonably (ui-ux-pro-max "responsive-chart"/"adaptive-navigation").
class ReportsTab extends ConsumerWidget {
  const ReportsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(selectedReportIdProvider);

    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 900;

        if (isNarrow) {
          if (selectedId == null) {
            return const Card(margin: EdgeInsets.all(8), child: ReportListPane());
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => ref.read(selectedReportIdProvider.notifier).state = null,
                    icon: const Icon(Icons.arrow_back, size: 18),
                    label: const Text('Danh sách'),
                  ),
                ),
              ),
              Expanded(child: Card(margin: const EdgeInsets.all(8), child: ReportDetailPane(reportId: selectedId))),
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
                child: Card(margin: EdgeInsets.zero, child: ReportListPane()),
              ),
              const SizedBox(width: DashboardTheme.gridGap),
              Expanded(
                child: Card(
                  margin: EdgeInsets.zero,
                  child: selectedId == null
                      ? const Center(child: Text('Chọn 1 tin báo bên trái để xem chi tiết.'))
                      : ReportDetailPane(reportId: selectedId),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
