import '../../core/api_client.dart';

class DashboardRepository {
  DashboardRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getOverview({String? districtId, int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/overview', queryParameters: {
      if (districtId != null) 'district_id': districtId,
      'days': days,
    });
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getResponseTimeByDistrict({int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/response-time-by-district', queryParameters: {'days': days});
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<List<Map<String, dynamic>>> getResponseTimeByOfficer({int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/response-time-by-officer', queryParameters: {'days': days});
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<List<Map<String, dynamic>>> getVolumeTrend({int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/volume-trend', queryParameters: {'days': days});
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> getCameraQueue() async {
    final res = await _apiClient.dio.get('/admin/dashboard/camera-queue');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getDistricts() async {
    final res = await _apiClient.dio.get('/admin/dashboard/districts');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }
}
