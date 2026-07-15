import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'reports_filters.dart';

/// Ticks every 20s so incoming citizen reports appear on the dashboard without a manual
/// refresh ("khi người dân gửi tin thì trên dashboard cũng hiện tin"). Simple polling —
/// no websocket/SSE infrastructure exists yet on the backend, and 20s is more than fast
/// enough for a control-room glance without hammering the API.
final _reportsPollTickProvider = StreamProvider<int>((ref) {
  return Stream.periodic(const Duration(seconds: 20), (i) => i);
});

final reportsFiltersProvider = StateProvider<ReportsFilters>((ref) => const ReportsFilters());

final reportListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  ref.watch(_reportsPollTickProvider); // each tick is a new AsyncValue → rebuild
  final filters = ref.watch(reportsFiltersProvider);
  return ref.watch(reportsRepositoryProvider).listReports(
        status: filters.status,
        urgency: filters.urgency,
        districtId: filters.districtId,
      );
});

/// Which report is shown in the detail pane of the master-detail Reports tab.
final selectedReportIdProvider = StateProvider<String?>((ref) => null);

final reportDetailProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, reportId) {
  return ref.watch(reportsRepositoryProvider).getDetail(reportId);
});
