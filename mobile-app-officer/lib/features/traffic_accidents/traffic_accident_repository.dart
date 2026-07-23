import '../../core/api_client.dart';

/// Object-detection-only alerts (YOLO person/vehicle detection + collision heuristic +
/// license-plate OCR from a paired external detector — never face/person recognition or
/// cross-camera tracking, see backend's TrafficAccidentAlert docstring). Every alert starts
/// `pending` — confirming/dismissing is always an explicit officer action.
class TrafficAccidentRepository {
  TrafficAccidentRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> listAlerts({String? status}) async {
    final res = await _apiClient.dio.get('/officer/traffic-accident-alerts', queryParameters: {
      if (status != null) 'status': status,
    });
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> getDetail(String alertId) async {
    final res = await _apiClient.dio.get('/officer/traffic-accident-alerts/$alertId');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> confirm(String alertId) async {
    await _apiClient.dio.post('/officer/traffic-accident-alerts/$alertId/confirm');
  }

  Future<void> dismiss(String alertId) async {
    await _apiClient.dio.post('/officer/traffic-accident-alerts/$alertId/dismiss');
  }
}
