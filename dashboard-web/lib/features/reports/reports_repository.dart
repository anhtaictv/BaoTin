import '../../core/api_client.dart';

/// Same /officer/reports* endpoints as mobile-app-officer — already open to admin/
/// senior_officer with no district restriction (see backend officerReports.routes.ts /
/// districtScope.ts unrestricted roles), so nothing new was needed on the backend for
/// the dashboard to show/verify incoming reports.
class ReportsRepository {
  ReportsRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> listReports({String? status, String? urgency, String? districtId}) async {
    final res = await _apiClient.dio.get('/officer/reports', queryParameters: {
      if (status != null) 'status': status,
      if (urgency != null) 'urgency': urgency,
      if (districtId != null) 'district_id': districtId,
    });
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> getDetail(String reportId) async {
    final res = await _apiClient.dio.get('/officer/reports/$reportId');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> updateStatus(String reportId, String status, {String? note}) async {
    await _apiClient.dio.patch('/officer/reports/$reportId/status', data: {
      'status': status,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
  }
}
