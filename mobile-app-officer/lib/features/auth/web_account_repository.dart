import '../../core/api_client.dart';
import '../../core/secure_token_store.dart';

/// Login/account-management for the 3rd credential system: `web_accounts`, username/password
/// provisioned in bulk by admin for all 102 xã/phường (backend/prisma/seed/seed-web-accounts.ts),
/// separate from both the OTP officer table and the self-registration officer/password table
/// (see officer_registration_repository.dart). Matches backend/src/api/auth/webAccount.routes.ts.
class WebAccountRepository {
  WebAccountRepository(this._apiClient, this._tokenStore);

  final ApiClient _apiClient;
  final SecureTokenStore _tokenStore;

  /// Returns true if the account must change its (temp) password before continuing —
  /// caller is responsible for routing to ChangePasswordScreen(forWebAccount: true) first.
  Future<bool> login({required String username, required String password}) async {
    final res = await _apiClient.dio.post(
      '/auth/web/login',
      data: {'username': username, 'password': password},
    );
    final data = res.data['data'] as Map<String, dynamic>;
    await _tokenStore.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    return data['mustChangePassword'] as bool? ?? false;
  }

  Future<void> changePassword({required String oldPassword, required String newPassword}) async {
    await _apiClient.dio.patch('/web-accounts/me/password', data: {
      'oldPassword': oldPassword,
      'newPassword': newPassword,
    });
  }

  /// Admin-only — backend returns 403 for any other role.
  Future<List<Map<String, dynamic>>> listAccounts() async {
    final res = await _apiClient.dio.get('/admin/web-accounts');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  /// Returns the new one-time temp password — shown once in the UI, never persisted.
  Future<String> resetPassword(String officerId) async {
    final res = await _apiClient.dio.post('/admin/web-accounts/$officerId/reset-password');
    return (res.data['data'] as Map<String, dynamic>)['tempPassword'] as String;
  }
}
