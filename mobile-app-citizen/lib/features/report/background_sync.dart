import 'package:workmanager/workmanager.dart';
import '../../core/api_client.dart';
import '../../core/secure_token_store.dart';
import 'pending_reports_queue.dart';
import 'report_repository.dart';

/// Registered with both the OS scheduler (Android WorkManager / iOS BGTaskScheduler) and
/// [Workmanager.registerPeriodicTask] below — must match exactly, and matches
/// ios/Runner/Info.plist's BGTaskSchedulerPermittedIdentifiers entry.
const backgroundSyncTaskName = 'bao_tin_pending_reports_sync';

/// Runs in its own background isolate/engine spawned by the OS — cannot reach the running
/// app's Riverpod container, so it rebuilds the same minimal chain providers.dart wires up
/// (ApiClient → ReportRepository → PendingReportsQueue) instead of duplicating flush()'s
/// submission logic. `Workmanager().executeTask` already calls
/// `WidgetsFlutterBinding.ensureInitialized()` before invoking this handler.
@pragma('vm:entry-point')
void backgroundSyncCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    final tokenStore = SecureTokenStore();
    final apiClient = ApiClient(tokenStore: tokenStore);
    final queue = PendingReportsQueue(ReportRepository(apiClient));
    // No signed-in session (never logged in, or a prior flush already cleared the token after
    // a refresh failure) — nothing to flush, and building an ApiClient with no token is safe,
    // it just sends unauthenticated requests that flush()'s catch-all already handles.
    await queue.flush();
    return true;
  });
}

/// Android's WorkManager runs this reliably on its own schedule. iOS's BGTaskScheduler backing
/// is best-effort — the OS decides if/when to actually invoke it based on app usage patterns;
/// that's a platform limitation, not a gap in this registration.
Future<void> registerBackgroundSync() async {
  await Workmanager().initialize(backgroundSyncCallbackDispatcher);
  await Workmanager().registerPeriodicTask(
    backgroundSyncTaskName,
    backgroundSyncTaskName,
    frequency: const Duration(minutes: 15),
    constraints: Constraints(networkType: NetworkType.connected),
  );
}
