import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme.dart';
import '../dashboard_filters.dart';
import '../dashboard_providers.dart';

/// ui-ux-pro-max chart guidance: "filters in one row above the charts". Changing either
/// control updates dashboardFiltersProvider once, which every chart/KPI provider watches
/// independently — see dashboard_providers.dart.
class FilterBar extends ConsumerWidget {
  const FilterBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(dashboardFiltersProvider);
    final districtsAsync = ref.watch(districtOptionsProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: DashboardTheme.cardPadding + 4, vertical: 10),
        child: Wrap(
          spacing: 16,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text('Khoảng thời gian', style: Theme.of(context).textTheme.bodySmall),
            SegmentedButton<int>(
              segments: [
                for (final days in kDashboardDayOptions)
                  ButtonSegment(value: days, label: Text('$days ngày')),
              ],
              selected: {filters.days},
              onSelectionChanged: (selection) {
                ref.read(dashboardFiltersProvider.notifier).state = filters.copyWithDays(selection.first);
              },
            ),
            const SizedBox(width: 8),
            Text('Địa bàn', style: Theme.of(context).textTheme.bodySmall),
            districtsAsync.when(
              data: (districts) => DropdownMenu<String?>(
                initialSelection: filters.districtId,
                width: 220,
                menuHeight: 320,
                dropdownMenuEntries: [
                  const DropdownMenuEntry(value: null, label: 'Tất cả địa bàn'),
                  for (final d in districts)
                    DropdownMenuEntry(value: d['id'] as String, label: d['tenXa'] as String),
                ],
                onSelected: (value) {
                  ref.read(dashboardFiltersProvider.notifier).state = filters.copyWithDistrict(value);
                },
              ),
              loading: () => const SizedBox(
                width: 220,
                height: 36,
                child: Center(child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))),
              ),
              error: (_, __) => const SizedBox(width: 220, child: Text('Không tải được danh sách địa bàn')),
            ),
          ],
        ),
      ),
    );
  }
}
