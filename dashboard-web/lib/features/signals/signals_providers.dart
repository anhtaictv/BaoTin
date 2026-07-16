import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'signals_filters.dart';

final signalsFiltersProvider = StateProvider<SignalsFilters>((ref) => const SignalsFilters());

final signalListProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  final filters = ref.watch(signalsFiltersProvider);
  return ref.watch(signalsRepositoryProvider).listSignals(
        districtId: filters.districtId,
        trustLevel: filters.trustLevel,
      );
});

/// Which signal is shown in the detail pane of the master-detail Tin nhanh tab.
final selectedSignalIdProvider = StateProvider<String?>((ref) => null);

final signalDetailProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, signalId) {
  return ref.watch(signalsRepositoryProvider).getDetail(signalId);
});
