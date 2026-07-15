import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../shared/widgets/status_badge.dart';

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
          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusBadge(status: data['status'] as String? ?? 'pending'),
                const SizedBox(height: 16),
                Text('Mã tin báo: ${widget.reportId}', style: Theme.of(context).textTheme.bodyMedium),
                if (data['verifiedAt'] != null) ...[
                  const SizedBox(height: 8),
                  Text('Đã xác minh lúc: ${data['verifiedAt']}'),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
