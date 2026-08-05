import '../../core/api_client.dart';

class BroadcastAlertRepository {
  BroadcastAlertRepository(this._apiClient);

  final ApiClient _apiClient;

  /// A plain officer only gets back their own active district assignment(s); senior_officer/
  /// admin get every district (backend broadcastAlerts.service.ts listAvailableDistricts).
  Future<List<Map<String, dynamic>>> listDistricts() async {
    final res = await _apiClient.dio.get('/officer/broadcast-alerts/districts');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<void> send({required String districtId, required String message, required String urgency}) async {
    await _apiClient.dio.post('/officer/broadcast-alerts', data: {
      'districtId': districtId,
      'message': message,
      'urgency': urgency,
    });
  }
}
