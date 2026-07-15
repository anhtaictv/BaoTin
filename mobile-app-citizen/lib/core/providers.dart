import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'secure_token_store.dart';
import '../features/auth/auth_repository.dart';
import '../features/report/report_repository.dart';
import '../features/report/camera_gps_capture.dart';
import '../features/emergency/emergency_repository.dart';

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) => SecureTokenStore());

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(tokenStore: ref.watch(secureTokenStoreProvider)),
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider), ref.watch(secureTokenStoreProvider)),
);

final reportRepositoryProvider = Provider<ReportRepository>(
  (ref) => ReportRepository(ref.watch(apiClientProvider)),
);

final emergencyRepositoryProvider = Provider<EmergencyRepository>(
  (ref) => EmergencyRepository(ref.watch(apiClientProvider)),
);

final locationResolverProvider = Provider<LocationResolver>((ref) => LocationResolver());

final cameraGpsCaptureProvider = Provider<CameraGpsCapture>((ref) => CameraGpsCapture());
