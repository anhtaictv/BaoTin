import 'package:dio/dio.dart';
import 'secure_token_store.dart';

/// Base URL is injected at build time so dev/staging/prod never share a hardcoded value:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

/// Thrown when a refresh attempt itself fails — callers should route to the OTP login screen.
class SessionExpiredException implements Exception {}

class ApiClient {
  ApiClient({required SecureTokenStore tokenStore})
      : _tokenStore = tokenStore,
        _dio = Dio(BaseOptions(baseUrl: _apiBaseUrl, connectTimeout: const Duration(seconds: 10))) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStore.readAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isUnauthorized = error.response?.statusCode == 401;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;
          if (isUnauthorized && !alreadyRetried) {
            try {
              await _refreshAccessToken();
              final retryOptions = error.requestOptions..extra['retried'] = true;
              final response = await _dio.fetch(retryOptions);
              handler.resolve(response);
              return;
            } catch (_) {
              await _tokenStore.clear();
              handler.reject(DioException(requestOptions: error.requestOptions, error: SessionExpiredException()));
              return;
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio _dio;
  final SecureTokenStore _tokenStore;

  Dio get dio => _dio;

  Future<void> _refreshAccessToken() async {
    final refreshToken = await _tokenStore.readRefreshToken();
    if (refreshToken == null) throw SessionExpiredException();

    // Bypasses the interceptor above (fresh Dio) to avoid recursive refresh attempts.
    final response = await Dio(BaseOptions(baseUrl: _apiBaseUrl)).post(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = response.data['data'] as Map<String, dynamic>;
    await _tokenStore.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  }
}
