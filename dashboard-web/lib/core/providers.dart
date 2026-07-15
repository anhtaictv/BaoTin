import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'secure_token_store.dart';
import '../features/auth/dashboard_auth_repository.dart';
import '../features/dashboard/dashboard_repository.dart';
import '../features/reports/reports_repository.dart';
import '../features/cameras/camera_repository.dart';

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) => SecureTokenStore());

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(tokenStore: ref.watch(secureTokenStoreProvider)),
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
