import '../../core/api_client.dart';
import '../../core/secure_token_store.dart';

/// Username/password registration+login for officers, alongside the pre-existing OTP flow
/// (officer_auth_repository.dart) — matches backend auth/registration.routes.ts and
/// admin/officerApproval.routes.ts. A self-registered officer stays locked out
/// (APPROVAL_PENDING / APPROVAL_REJECTED) until an admin approves them (see
/// approve/reject below, admin-only server-side).
class OfficerRegistrationRepository {
  OfficerRegistrationRepository(this._apiClient, this._tokenStore);

  final ApiClient _apiClient;
  final SecureTokenStore _tokenStore;

  Future<void> registerOfficer({
    required String username,
    required String password,
    required String fullName,
    required String phoneNumber,
    required String cccdNumber,
    required String address,
  }) async {
    await _apiClient.dio.post('/auth/register/officer', data: {
      'username': username,
      'password': password,
      'fullName': fullName,
      'phoneNumber': phoneNumber,
      'cccdNumber': cccdNumber,
      'address': address,
    });
  }

  Future<void> loginOfficer({required String username, required String password}) async {
    final res = await _apiClient.dio.post(
      '/auth/login/officer',
      data: {'username': username, 'password': password},
    );
    final data = res.data['data'] as Map<String, dynamic>;
    await _tokenStore.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  }

  /// Admin-only — backend returns 403 for any other role.
  Future<List<Map<String, dynamic>>> listPendingOfficers() async {
    final res = await _apiClient.dio.get('/admin/officers/pending');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<void> approve(String officerId) async {
    await _apiClient.dio.post('/admin/officers/$officerId/approve');
  }

  Future<void> reject(String officerId) async {
    await _apiClient.dio.post('/admin/officers/$officerId/reject');
  }
}
