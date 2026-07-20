import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../shared/widgets/status_badge.dart';

/// Cùng danh mục với backend/src/services/priority.service.ts HIGH_PRIORITY_CATEGORIES —
/// và cùng key với dropdown loại vụ việc ở bao_tin_screen.dart (không phải nhãn tiếng Việt).
const _highPriorityCategories = {'chay_no', 'tai_nan', 'an_ninh_khan_cap'};

/// Giai đoạn 4 "Gợi ý gửi tố cáo chính thức qua VNeID cho tin nghiêm trọng" — CLAUDE.md:
/// Báo Tin bổ trợ VNeID, không thay thế. Chỉ là gợi ý văn bản, không có link/API VNeID thật
/// nào được gọi ở đây.
bool _isSeriousReport({String? urgency, String? category}) {
  return urgency == 'emergency' || (category != null && _highPriorityCategories.contains(category));
}

class ReportStatusScreen extends ConsumerStatefulWidget {
  const ReportStatusScreen({super.key, required this.reportId});

  final String reportId;

  @override
  ConsumerState<ReportStatusScreen> createState() => _ReportStatusScreenState();
}

class _ReportStatusScreenState extends ConsumerState<ReportStatusScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(reportRepositoryProvider).getStatus(widget.reportId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trạng thái tin báo')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return const Center(child: Text('Không tải được trạng thái tin báo.'));
          }
          final data = snapshot.data!;
          final status = data['status'] as String? ?? 'pending';
          final latestNote = data['latestNote'] as String?;
          final category = data['category'] as String?;
          final isSerious = status != 'confirmed_false' &&
              _isSeriousReport(urgency: data['urgency'] as String?, category: category);
          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(categoryIcon(category), size: 20, color: Theme.of(context).colorScheme.primary),
                    const SizedBox(width: 8),
                    Text(categoryLabel(category), style: Theme.of(context).textTheme.titleMedium),
                  ],
                ),
                const SizedBox(height: 12),
                StatusBadge(status: status),
                const SizedBox(height: 16),
                Text('Mã tin báo: ${widget.reportId}', style: Theme.of(context).textTheme.bodyMedium),
                if (data['verifiedAt'] != null) ...[
                  const SizedBox(height: 8),
                  Text(_formatVerifiedAt(data['verifiedAt'] as String)),
                ],
                if (latestNote != null && latestNote.trim().isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Ghi chú từ cán bộ phụ trách',
                            style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          Text(latestNote),
                        ],
                      ),
                    ),
                  ),
                ],
                if (isSerious) ...[
                  const SizedBox(height: 20),
                  Card(
                    color: Colors.blue.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Tin báo này có tính chất nghiêm trọng. Để được xử lý theo đúng quy trình '
                              'pháp lý, bạn có thể cân nhắc gửi tố cáo chính thức qua ứng dụng VNeID — '
                              'Báo Tin chỉ là kênh phản ứng nhanh tại chỗ, bổ trợ chứ không thay thế VNeID.',
                              style: TextStyle(color: Colors.blue.shade900, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

String _formatVerifiedAt(String iso) {
  try {
    return 'Đã xác minh lúc: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(iso).toLocal())}';
  } catch (_) {
    return 'Đã xác minh lúc: $iso';
  }
}
