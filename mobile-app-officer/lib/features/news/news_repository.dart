import '../../core/api_client.dart';

class NewsRepository {
  NewsRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> list() async {
    final res = await _apiClient.dio.get('/news');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }
}
