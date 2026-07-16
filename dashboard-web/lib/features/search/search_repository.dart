import '../../core/api_client.dart';

/// Trợ lý tìm kiếm ngôn ngữ tự nhiên (AI cục bộ, chạy qua Ollama phía backend) — AI chỉ dùng
/// để trích xuất bộ lọc (địa bàn/thời gian/từ khóa) từ câu hỏi, kết quả luôn là dữ liệu thật từ
/// database, không phải câu trả lời do AI tự bịa (backend/src/services/searchAssistant.service.ts).
class SearchRepository {
  SearchRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> search(String query) async {
    final res = await _apiClient.dio.post('/admin/search', data: {'query': query});
    return res.data['data'] as Map<String, dynamic>;
  }
}
