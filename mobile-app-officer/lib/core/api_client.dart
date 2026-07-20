import 'package:dio/dio.dart';
import 'secure_token_store.dart';

const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
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
              // The refresh token rotates server-side (single-use — old one invalidated the
              // instant a new one is issued, see backend auth.service.ts rotateRefreshToken).
              // HomeShell's IndexedStack mounts every tab at once, so on an expired access
              // token, all of them 401 in the same frame — without sharing one in-flight
              // refresh, each would race to rotate the same token, only the first would
              // succeed, and the rest would hit the catch below and clear() the tokens the
              // winner just saved, logging the officer out roughly every access-token TTL.
              _refreshing ??= _refreshAccessToken();
              await _refreshing;
              final retryOptions = error.requestOptions..extra['retried'] = true;
              final response = await _dio.fetch(retryOptions);
              handler.resolve(response);
              return;
            } catch (_) {
              await _tokenStore.clear();
              handler.reject(DioException(requestOptions: error.requestOptions, error: SessionExpiredException()));
              return;
            } finally {
              _refreshing = null;
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio _dio;
  final SecureTokenStore _tokenStore;
  Future<void>? _refreshing;

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
