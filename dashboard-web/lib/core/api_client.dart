import 'package:dio/dio.dart';
import 'secure_token_store.dart';

/// Web target — no Android-emulator loopback trick needed here, unlike the mobile apps.
const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);

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
