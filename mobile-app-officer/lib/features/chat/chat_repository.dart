import '../../core/api_client.dart';
import '../../core/secure_token_store.dart';

/// Chat giữa các đơn vị — "chat chung" (mọi cán bộ) + "chat riêng từng đơn vị" (đơn vị đó +
/// admin/senior_officer). Which channels are visible/writable is decided entirely by the
/// backend (chat.service.ts) — this repository just calls the endpoints and lets a 403 fail,
/// same "no client-side role check" philosophy as wanted_notices_repository.dart.
class ChatRepository {
  ChatRepository(this._apiClient, this._tokenStore);

  final ApiClient _apiClient;
  final SecureTokenStore _tokenStore;

  Future<String?> currentOfficerId() => _tokenStore.readOfficerId();

  Future<List<Map<String, dynamic>>> listChannels() async {
    final res = await _apiClient.dio.get('/officer/chat/channels');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<List<Map<String, dynamic>>> listMessages({
    required String channelType,
    String? districtId,
    DateTime? before,
  }) async {
    final res = await _apiClient.dio.get(
      '/officer/chat/messages',
      queryParameters: {
        'channel_type': channelType,
        if (districtId != null) 'district_id': districtId,
        if (before != null) 'before': before.toIso8601String(),
      },
    );
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  Future<Map<String, dynamic>> sendMessage({
    required String channelType,
    String? districtId,
    required String content,
  }) async {
    final res = await _apiClient.dio.post(
      '/officer/chat/messages',
      data: {
        'channelType': channelType,
        if (districtId != null) 'districtId': districtId,
        'content': content,
      },
    );
    return res.data['data'] as Map<String, dynamic>;
  }
}
