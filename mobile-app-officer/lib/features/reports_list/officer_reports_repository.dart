import '../../core/api_client.dart';

class ReportsPage {
  ReportsPage({required this.reports, required this.page, required this.pageSize, required this.total, required this.hasMore});

  factory ReportsPage.fromJson(Map<String, dynamic> json) => ReportsPage(
        reports: List<Map<String, dynamic>>.from(json['reports'] as List),
        page: json['page'] as int,
        pageSize: json['pageSize'] as int,
        total: json['total'] as int,
        hasMore: json['hasMore'] as bool,
      );

  final List<Map<String, dynamic>> reports;
  final int page;
  final int pageSize;
  final int total;
  final bool hasMore;
}

class OfficerReportsRepository {
  OfficerReportsRepository(this._apiClient);

  final ApiClient _apiClient;

  /// Server does the priority sorting (emergency first) and district-scoping — this app
  /// never filters by district_id itself except to let an officer narrow within their own
  /// assignments, since the backend rejects any district_id outside them (403). Paginated
  /// server-side (default page_size 50, max 100) — callers that need "everything" (the map
  /// tab) should pass a large pageSize explicitly rather than assume an unbounded list.
  Future<ReportsPage> listReports({String? status, String? urgency, int page = 1, int pageSize = 50}) async {
    final res = await _apiClient.dio.get('/officer/reports', queryParameters: {
      if (status != null) 'status': status,
      if (urgency != null) 'urgency': urgency,
      'page': page,
      'page_size': pageSize,
    });
    return ReportsPage.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  /// Backs the "Tổng quan" tab — server-side aggregate (groupBy/count), not a full report
  /// fetch counted client-side, so the KPI tiles stay correct regardless of how many reports
  /// the district actually has.
  Future<Map<String, dynamic>> getOverviewStats() async {
    final res = await _apiClient.dio.get('/officer/reports/overview-stats');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getDetail(String reportId) async {
    final res = await _apiClient.dio.get('/officer/reports/$reportId');
    return res.data['data'] as Map<String, dynamic>;
  }

  /// status must be one of verifying/confirmed_true/confirmed_false — the officer always
  /// makes this choice explicitly (CLAUDE.md: human-in-the-loop, no AI auto-conclusion).
  Future<void> updateStatus(String reportId, String status, {String? note}) async {
    await _apiClient.dio.patch('/officer/reports/$reportId/status', data: {
      'status': status,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
  }
}
