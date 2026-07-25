import '../../core/api_client.dart';

/// Admin-only (backend requireAuth(["admin"])) — unlocks citizen accounts auto-locked by
/// officerReports.service.ts's lockIfRepeatedlyFalse (4th confirmed_false report). Same
/// no-client-side-role-check convention as officer_registration_repository.dart: the tab is
/// always visible, a non-admin just gets a clear message from the 403.
class LockedCitizensRepository {
  LockedCitizensRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> listLocked() async {
    final res = await _apiClient.dio.get('/admin/citizens/locked');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<void> unlock(String userId) async {
    await _apiClient.dio.post('/admin/citizens/$userId/unlock');
  }
}
