import '../../core/api_client.dart';

class EmergencyRepository {
  EmergencyRepository(this._apiClient);

  final ApiClient _apiClient;

  /// No attachments, no description — API_SPEC.md: the SOS path must not be slowed down
  /// by anything non-essential to getting the report filed.
  Future<String> createEmergencyReport({
    required String emergencyType,
    required double lat,
    required double lng,
    String? clientRequestId,
  }) async {
    final res = await _apiClient.dio.post('/reports/emergency', data: {
      'emergencyType': emergencyType,
      'location': {'lat': lat, 'lng': lng},
      if (clientRequestId != null) 'clientRequestId': clientRequestId,
    });
    final data = res.data['data'] as Map<String, dynamic>;
    return data['reportId'] as String;
  }
}
