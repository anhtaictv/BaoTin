import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';

class WantedNoticesRepository {
  WantedNoticesRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> list() async {
    final res = await _apiClient.dio.get('/wanted-notices');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  /// senior_officer/admin only — backend returns 403 for a plain "officer" account.
  Future<void> post({required Uint8List bytes, required String filename}) async {
    final formData = FormData();
    formData.files.add(MapEntry('photo', MultipartFile.fromBytes(bytes, filename: filename)));
    await _apiClient.dio.post('/wanted-notices', data: formData);
  }
}
