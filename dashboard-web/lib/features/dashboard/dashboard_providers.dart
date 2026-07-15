import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'dashboard_filters.dart';

/// Single source of truth for the filter bar (date range + district). Every provider
/// below watches this, so updating it re-fetches every dependent chart automatically —
/// but each chart's FutureProvider is independent, so a slow/failed one never blocks
/// the others from rendering (see dashboard_screen.dart: each widget has its own
/// AsyncValue, not one shared page-level loading state).
final dashboardFiltersProvider = StateProvider<DashboardFilters>((ref) => const DashboardFilters());

final districtOptionsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(dashboardRepositoryProvider).getDistricts();
});

final overviewProvider = FutureProvider<Map<String, dynamic>>((ref) {
  final filters = ref.watch(dashboardFiltersProvider);
  return ref
      .watch(dashboardRepositoryProvider)
      .getOverview(districtId: filters.districtId, days: filters.days);
});

final responseTimeByDistrictProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  final filters = ref.watch(dashboardFiltersProvider);
  return ref.watch(dashboardRepositoryProvider).getResponseTimeByDistrict(days: filters.days);
});

final responseTimeByOfficerProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  final filters = ref.watch(dashboardFiltersProvider);
  return ref.watch(dashboardRepositoryProvider).getResponseTimeByOfficer(days: filters.days);
});

final volumeTrendProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  final filters = ref.watch(dashboardFiltersProvider);
  return ref.watch(dashboardRepositoryProvider).getVolumeTrend(days: filters.days);
});

final cameraQueueProvider = FutureProvider<Map<String, dynamic>>((ref) {
  // Not filter-dependent (queue state isn't scoped to a date range/district) — still
  // re-fetchable via ref.invalidate(cameraQueueProvider) from a manual refresh action.
  return ref.watch(dashboardRepositoryProvider).getCameraQueue();
});
