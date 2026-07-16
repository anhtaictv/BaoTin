import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'secure_token_store.dart';
import '../features/auth/officer_auth_repository.dart';
import '../features/reports_list/officer_reports_repository.dart';
import '../features/cameras/camera_repository.dart';
import '../features/signals/signals_repository.dart';

final secureTokenStoreProvider = Provider<SecureTokenStore>((ref) => SecureTokenStore());

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(tokenStore: ref.watch(secureTokenStoreProvider)),
);

final officerAuthRepositoryProvider = Provider<OfficerAuthRepository>(
  (ref) => OfficerAuthRepository(ref.watch(apiClientProvider), ref.watch(secureTokenStoreProvider)),
);

final officerReportsRepositoryProvider = Provider<OfficerReportsRepository>(
  (ref) => OfficerReportsRepository(ref.watch(apiClientProvider)),
);

final cameraRepositoryProvider = Provider<CameraRepository>(
  (ref) => CameraRepository(ref.watch(apiClientProvider)),
);

final signalsRepositoryProvider = Provider<SignalsRepository>(
  (ref) => SignalsRepository(ref.watch(apiClientProvider)),
);
