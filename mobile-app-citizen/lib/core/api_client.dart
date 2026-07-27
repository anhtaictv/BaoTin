import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'secure_token_store.dart';

/// Base URL is injected at build time so dev/staging/prod never share a hardcoded value:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

/// Thrown when a refresh attempt itself fails — callers should route to the OTP login screen.
class SessionExpiredException implements Exception {}

/// Bumped whenever tokens are cleared after a failed refresh, so the UI can route back to
/// login without every screen needing to catch [SessionExpiredException] individually
/// (see auth_gate.dart, which listens to this).
final sessionExpiredTick = ValueNotifier<int>(0);

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
          final hadToken = error.requestOptions.headers['Authorization'] != null;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;
          // A 401 with no Authorization header on the original request (login, OTP verify,
          // register...) can only mean wrong credentials, never an expired session — attempting
          // a refresh here fails immediately (no refresh token yet) and replaces the real
          // INVALID_CREDENTIALS response with a bare SessionExpiredException that has no
          // `response`, which login_screen.dart then shows as "can't connect to server"
          // instead of "wrong password". Only authenticated calls (a real token was sent) are
          // eligible for refresh-and-retry.
          if (isUnauthorized && hadToken && !alreadyRetried) {
            try {
              // Shared across concurrent 401s so two requests racing the same expired access
              // token don't each present the same refresh token to the backend — only one
              // refresh happens; the other awaits its result instead of getting rotated out.
              await (_refreshFuture ??= _refreshAccessToken().whenComplete(() => _refreshFuture = null));
              final retryOptions = error.requestOptions..extra['retried'] = true;
              final response = await _dio.fetch(retryOptions);
              handler.resolve(response);
              return;
            } catch (_) {
              await _tokenStore.clear();
              sessionExpiredTick.value++;
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
  Future<void>? _refreshFuture;

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
