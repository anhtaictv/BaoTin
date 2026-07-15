import '../../core/api_client.dart';
import '../../core/secure_token_store.dart';

class AuthRepository {
  AuthRepository(this._apiClient, this._tokenStore);

  final ApiClient _apiClient;
  final SecureTokenStore _tokenStore;

  /// Returns the dev-only OTP echoed by the backend outside production (see
  /// backend auth.service.ts) so this can be tested end-to-end before a real
  /// SMS/Zalo OA provider is wired up. Always null against a production API.
  Future<String?> requestOtp(String phoneNumber) async {
    final res = await _apiClient.dio.post('/auth/otp/request', data: {'phoneNumber': phoneNumber});
    final data = res.data['data'] as Map<String, dynamic>;
    return data['devOtp'] as String?;
  }

  Future<void> verifyOtp({required String phoneNumber, required String otp}) async {
    final res = await _apiClient.dio.post('/auth/otp/verify', data: {'phoneNumber': phoneNumber, 'otp': otp});
    final data = res.data['data'] as Map<String, dynamic>;
    await _tokenStore.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  }

  Future<bool> isLoggedIn() async => (await _tokenStore.readAccessToken()) != null;

  Future<void> logout() async {
    try {
      await _apiClient.dio.post('/auth/sessions/revoke-all');
    } catch (_) {
      // Best-effort server-side revoke — clearing local tokens below is what actually logs out.
    }
    await _tokenStore.clear();
  }
}
