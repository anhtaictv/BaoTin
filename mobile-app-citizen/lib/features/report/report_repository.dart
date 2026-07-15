import 'dart:convert';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';

class ReportRepository {
  ReportRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<String> createReport({
    required String category,
    String? description,
    required double lat,
    required double lng,
    required String locationSource,
    List<String> attachmentPaths = const [],
  }) async {
    final formData = FormData();
    formData.fields.add(MapEntry('category', category));
    if (description != null && description.trim().isNotEmpty) {
      formData.fields.add(MapEntry('description', description.trim()));
    }
    formData.fields.add(
      MapEntry('location', jsonEncode({'lat': lat, 'lng': lng, 'source': locationSource})),
    );
    for (final path in attachmentPaths) {
      formData.files.add(MapEntry('attachments', await MultipartFile.fromFile(path)));
    }

    final res = await _apiClient.dio.post('/reports', data: formData);
    final data = res.data['data'] as Map<String, dynamic>;
    return data['reportId'] as String;
  }

  Future<List<Map<String, dynamic>>> listMine() async {
    final res = await _apiClient.dio.get('/reports/mine');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> getStatus(String reportId) async {
    final res = await _apiClient.dio.get('/reports/$reportId/status');
    return res.data['data'] as Map<String, dynamic>;
  }
}
