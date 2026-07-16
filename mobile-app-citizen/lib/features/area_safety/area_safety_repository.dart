import '../../core/api_client.dart';

/// Giai đoạn 3 — "Bản đồ cảnh báo khu vực" + "Danh bạ khẩn cấp theo vị trí". Both endpoints
/// are read-only and only ever return aggregated/reference data, never an individual
/// report's location or detail (API_SPEC.md).
class AreaSafetyRepository {
  AreaSafetyRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getAreaAlerts({required double lat, required double lng}) async {
    final res = await _apiClient.dio.get('/area-alerts', queryParameters: {'lat': lat, 'lng': lng});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getEmergencyContacts({required double lat, required double lng}) async {
    final res = await _apiClient.dio.get('/emergency-contacts', queryParameters: {'lat': lat, 'lng': lng});
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }
}
