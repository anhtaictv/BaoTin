import '../../core/api_client.dart';

/// Mirrors dashboard-web-react's dashboardApi.ts — same endpoints, same admin/senior_officer
/// gate (backend/src/api/admin/dashboard.routes.ts). Plain officers get a 403 handled by the
/// screen, same convention as pending_officers_screen.dart.
class AdminDashboardRepository {
  AdminDashboardRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> getOverview({int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/overview', queryParameters: {'days': days});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getVolumeTrend({int days = 30, String period = 'day'}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/volume-trend', queryParameters: {
      'days': days,
      'period': period,
    });
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<List<Map<String, dynamic>>> getByCategory({int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/by-category', queryParameters: {'days': days});
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<List<Map<String, dynamic>>> getReportCountByDistrict({int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/report-count-by-district', queryParameters: {'days': days});
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<List<Map<String, dynamic>>> getReportLocations({int days = 30}) async {
    final res = await _apiClient.dio.get('/admin/dashboard/report-locations', queryParameters: {'days': days});
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }
}
