import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'navigation.dart';
import 'secure_token_store.dart';
import '../features/auth/dashboard_auth_repository.dart';
import '../features/auth/dashboard_login_screen.dart';
import '../features/dashboard/dashboard_repository.dart';
import '../features/reports/reports_repository.dart';
import '../features/cameras/camera_repository.dart';
import '../features/signals/signals_repository.dart';
import '../features/search/search_repository.dart';

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) => SecureTokenStore());

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(
    tokenStore: ref.watch(secureTokenStoreProvider),
    // Mid-session token expiry (refresh failed) — kick the user back to login instead of
    // leaving every screen stuck on a generic, permanently-failing error state.
    onSessionExpired: () => dashboardNavigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const DashboardLoginScreen()),
      (route) => false,
    ),
  ),
);

final dashboardAuthRepositoryProvider = Provider<DashboardAuthRepository>(
  (ref) => DashboardAuthRepository(ref.watch(apiClientProvider), ref.watch(secureTokenStoreProvider)),
);

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepository(ref.watch(apiClientProvider)),
);

final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => ReportsRepository(ref.watch(apiClientProvider)),
);

final cameraRepositoryProvider = Provider<CameraRepository>(
  (ref) => CameraRepository(ref.watch(apiClientProvider)),
);

final signalsRepositoryProvider = Provider<SignalsRepository>(
  (ref) => SignalsRepository(ref.watch(apiClientProvider)),
);

final searchRepositoryProvider = Provider<SearchRepository>(
  (ref) => SearchRepository(ref.watch(apiClientProvider)),
);
