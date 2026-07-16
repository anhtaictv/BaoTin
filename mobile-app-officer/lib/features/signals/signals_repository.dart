import '../../core/api_client.dart';

/// Giai đoạn 2 "kênh tình báo mở" — strictly read-only, never writes anything. Server does
/// the district-scoping the same way it does for /officer/reports (CLAUDE.md #1: this data
/// is deliberately a separate table/endpoint from reports, never merged).
class SignalsRepository {
  SignalsRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> listSignals({String? trustLevel, String? category}) async {
    final res = await _apiClient.dio.get('/officer/signals', queryParameters: {
      if (trustLevel != null) 'trust_level': trustLevel,
      if (category != null) 'category': category,
    });
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> getDetail(String signalId) async {
    final res = await _apiClient.dio.get('/officer/signals/$signalId');
    return res.data['data'] as Map<String, dynamic>;
  }
}
