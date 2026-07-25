import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'secure_token_store.dart';
import '../features/auth/officer_auth_repository.dart';
import '../features/auth/officer_registration_repository.dart';
import '../features/reports_list/officer_reports_repository.dart';
import '../features/cameras/camera_repository.dart';
import '../features/signals/signals_repository.dart';
import '../features/wanted/wanted_notices_repository.dart';
import '../features/analytics/admin_dashboard_repository.dart';
import '../features/traffic_accidents/traffic_accident_repository.dart';
import '../features/news/news_repository.dart';
import '../features/admin_citizens/locked_citizens_repository.dart';

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) => SecureTokenStore());

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(tokenStore: ref.watch(secureTokenStoreProvider)),
);

final officerAuthRepositoryProvider = Provider<OfficerAuthRepository>(
  (ref) => OfficerAuthRepository(ref.watch(apiClientProvider), ref.watch(secureTokenStoreProvider)),
);

final officerRegistrationRepositoryProvider = Provider<OfficerRegistrationRepository>(
  (ref) => OfficerRegistrationRepository(ref.watch(apiClientProvider), ref.watch(secureTokenStoreProvider)),
);

final officerReportsRepositoryProvider = Provider<OfficerReportsRepository>(
  (ref) => OfficerReportsRepository(ref.watch(apiClientProvider)),
);

final lockedCitizensRepositoryProvider = Provider<LockedCitizensRepository>(
  (ref) => LockedCitizensRepository(ref.watch(apiClientProvider)),
);

final cameraRepositoryProvider = Provider<CameraRepository>(
  (ref) => CameraRepository(ref.watch(apiClientProvider)),
);

final signalsRepositoryProvider = Provider<SignalsRepository>(
  (ref) => SignalsRepository(ref.watch(apiClientProvider)),
);

final wantedNoticesRepositoryProvider = Provider<WantedNoticesRepository>(
  (ref) => WantedNoticesRepository(ref.watch(apiClientProvider)),
);

final adminDashboardRepositoryProvider = Provider<AdminDashboardRepository>(
  (ref) => AdminDashboardRepository(ref.watch(apiClientProvider)),
);

final trafficAccidentRepositoryProvider = Provider<TrafficAccidentRepository>(
  (ref) => TrafficAccidentRepository(ref.watch(apiClientProvider)),
);

final newsRepositoryProvider = Provider<NewsRepository>(
  (ref) => NewsRepository(ref.watch(apiClientProvider)),
);
