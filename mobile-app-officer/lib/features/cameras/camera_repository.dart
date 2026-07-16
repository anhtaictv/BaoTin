import '../../core/api_client.dart';

/// v1.1 — CLAUDE.md non-negotiable #8: this repository only ever moves camera *location*
/// and *request metadata* over the wire. It never fetches, plays, or stores video.
class CameraRepository {
  CameraRepository(this._apiClient);

  final ApiClient _apiClient;

  /// Auto-suggestion — called automatically when report detail loads, not behind a
  /// manual "search" action.
  Future<List<Map<String, dynamic>>> nearbyCameras(String reportId, {int radiusM = 500}) async {
    final res = await _apiClient.dio.get(
      '/officer/reports/$reportId/nearby-cameras',
      queryParameters: {'radius_m': radiusM},
    );
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }

  /// One call, N cameras (e.g. several along a route) — backend creates one independent
  /// administrative request per camera, sharing a groupId only for display purposes. There is
  /// no cross-camera matching/recognition involved (CLAUDE.md non-negotiable #8).
  Future<void> createExtractionRequest(
    String reportId, {
    required List<String> cameraIds,
    required DateTime timeRangeStart,
    required DateTime timeRangeEnd,
    String? note,
  }) async {
    await _apiClient.dio.post('/officer/reports/$reportId/camera-extraction-requests', data: {
      'cameraIds': cameraIds,
      'timeRangeStart': timeRangeStart.toUtc().toIso8601String(),
      'timeRangeEnd': timeRangeEnd.toUtc().toIso8601String(),
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> listExtractionRequests(String reportId) async {
    final res = await _apiClient.dio.get('/officer/reports/$reportId/camera-extraction-requests');
    return List<Map<String, dynamic>>.from(res.data['data'] as List);
  }
}
