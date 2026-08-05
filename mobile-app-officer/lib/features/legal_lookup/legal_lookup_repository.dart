import '../../core/api_client.dart';

/// Tra cứu văn bản luật/quy định (AI cục bộ qua Ollama) — AI chỉ dùng để hiểu câu hỏi thành
/// điều/khoản/từ khóa cần tìm, kết quả luôn là nguyên văn thật lấy từ corpus PDF đã nạp
/// (backend/src/services/legalLookup.service.ts), không phải do AI tự viết.
class LegalLookupRepository {
  LegalLookupRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> lookup(String query) async {
    final res = await _apiClient.dio.post('/legal-lookup', data: {'query': query});
    return res.data['data'] as Map<String, dynamic>;
  }
}
