import '../../core/api_client.dart';
import '../../core/secure_token_store.dart';

/// admin/senior_officer accounts are Officer rows (see backend schema.prisma OfficerRole) —
/// same dual-mode /auth/officer/login endpoint as mobile-app-officer, no separate auth flow.
class DashboardAuthRepository {
  DashboardAuthRepository(this._apiClient, this._tokenStore);

  final ApiClient _apiClient;
  final SecureTokenStore _tokenStore;

  Future<String?> requestOtp(String phoneNumber) async {
    final res = await _apiClient.dio.post('/auth/officer/login', data: {'phoneNumber': phoneNumber});
    final data = res.data['data'] as Map<String, dynamic>;
    return data['devOtp'] as String?;
  }

  Future<void> verifyOtp({required String phoneNumber, required String otp}) async {
    final res = await _apiClient.dio.post(
      '/auth/officer/login',
      data: {'phoneNumber': phoneNumber, 'otp': otp},
    );
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
      // Best-effort — clearing local tokens below is what actually logs the browser out.
    }
    await _tokenStore.clear();
  }
}
