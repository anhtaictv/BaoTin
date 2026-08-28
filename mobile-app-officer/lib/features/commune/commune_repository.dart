import '../../core/api_client.dart';

/// Trưởng xã (commune_head) chia nhỏ xã/phường mới mình phụ trách theo ranh giới cũ (trước
/// sáp nhập) và gán từng phần cho tài khoản cấp dưới — xem backend/src/services/
/// communeAssignment.service.ts. Ported from dashboard-web-react's commune feature; mobile
/// scope is commune_head's own district only (the admin cross-district picker stays a
/// dashboard-web-only affordance).
class CommuneRepository {
  CommuneRepository(this._apiClient);

  final ApiClient _apiClient;

  /// null for any role other than commune_head (or a commune_head not yet assigned a district).
  Future<Map<String, dynamic>?> myDistrict() async {
    final res = await _apiClient.dio.get('/officer/commune/my-district');
    return res.data['data'] as Map<String, dynamic>?;
  }

  Future<List<Map<String, dynamic>>> listOldWards(String districtId) async {
    final res = await _apiClient.dio.get('/officer/commune/$districtId/old-wards');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<List<Map<String, dynamic>>> listSubordinates(String districtId) async {
    final res = await _apiClient.dio.get('/officer/commune/$districtId/subordinates');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  /// oldDistrictId null clears the sub-area (cấp dưới phụ trách toàn bộ xã/phường mới).
  Future<void> assignSubordinate(String districtId, String officerId, String? oldDistrictId) async {
    await _apiClient.dio.post(
      '/officer/commune/$districtId/subordinates/$officerId/assignment',
      data: {'oldDistrictId': oldDistrictId},
    );
  }
}
