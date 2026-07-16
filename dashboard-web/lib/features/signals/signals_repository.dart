import '../../core/api_client.dart';

/// Giai đoạn 2 "kênh tình báo mở" — strictly read-only, same /officer/signals endpoint as
/// mobile-app-officer (admin/senior_officer already bypass district scoping, see
/// backend/src/middleware/districtScope.ts, so nothing district-specific is needed here).
class SignalsRepository {
  SignalsRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> listSignals({String? districtId, String? trustLevel}) async {
    final res = await _apiClient.dio.get('/officer/signals', queryParameters: {
      if (districtId != null) 'district_id': districtId,
      if (trustLevel != null) 'trust_level': trustLevel,
    });
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> getDetail(String signalId) async {
    final res = await _apiClient.dio.get('/officer/signals/$signalId');
    return res.data['data'] as Map<String, dynamic>;
  }
}
