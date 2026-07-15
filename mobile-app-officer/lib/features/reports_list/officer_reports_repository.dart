import '../../core/api_client.dart';

class OfficerReportsRepository {
  OfficerReportsRepository(this._apiClient);

  final ApiClient _apiClient;

  /// Server does the priority sorting (emergency first) and district-scoping — this app
  /// never filters by district_id itself except to let an officer narrow within their own
  /// assignments, since the backend rejects any district_id outside them (403).
  Future<List<Map<String, dynamic>>> listReports({String? status, String? urgency}) async {
    final res = await _apiClient.dio.get('/officer/reports', queryParameters: {
      if (status != null) 'status': status,
      if (urgency != null) 'urgency': urgency,
    });
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> getDetail(String reportId) async {
    final res = await _apiClient.dio.get('/officer/reports/$reportId');
    return res.data['data'] as Map<String, dynamic>;
  }

  /// status must be one of verifying/confirmed_true/confirmed_false — the officer always
  /// makes this choice explicitly (CLAUDE.md: human-in-the-loop, no AI auto-conclusion).
  Future<void> updateStatus(String reportId, String status, {String? note}) async {
    await _apiClient.dio.patch('/officer/reports/$reportId/status', data: {
      'status': status,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
  }
}
