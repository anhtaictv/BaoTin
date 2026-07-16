import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'extraction_request_dialog.dart';

/// Ported from mobile-app-officer — auto-suggests cameras near a report's location,
/// fetched automatically on mount, never behind a manual search action. CLAUDE.md
/// non-negotiable #8: only name + managing-unit contact, no play/preview/download.
class NearbyCamerasSection extends ConsumerStatefulWidget {
  const NearbyCamerasSection({super.key, required this.reportId});

  final String reportId;

  @override
  ConsumerState<NearbyCamerasSection> createState() => _NearbyCamerasSectionState();
}

class _NearbyCamerasSectionState extends ConsumerState<NearbyCamerasSection> {
  late Future<List<Map<String, dynamic>>> _future;
  String? _feedback;

  @override
  void initState() {
    super.initState();
    _future = ref.read(cameraRepositoryProvider).nearbyCameras(widget.reportId);
  }

  @override
  void didUpdateWidget(covariant NearbyCamerasSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reportId != widget.reportId) {
      setState(() {
        _feedback = null;
        _future = ref.read(cameraRepositoryProvider).nearbyCameras(widget.reportId);
      });
    }
  }

  void _retry() {
    setState(() {
      _feedback = null;
      _future = ref.read(cameraRepositoryProvider).nearbyCameras(widget.reportId);
    });
  }

  Future<void> _requestExtraction(Map<String, dynamic> camera) async {
    final result = await showExtractionRequestDialog(context, cameraName: camera['name'] as String);
    if (result == null) return;
    try {
      await ref.read(cameraRepositoryProvider).createExtractionRequest(
            widget.reportId,
            cameraId: camera['id'] as String,
            timeRangeStart: result.start,
            timeRangeEnd: result.end,
            note: result.note,
          );
      if (!mounted) return;
      setState(() => _feedback = 'Đã gửi yêu cầu trích xuất tới đơn vị quản lý camera.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _feedback = 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.videocam_outlined, size: 18),
                const SizedBox(width: 8),
                Text('Camera an ninh gần hiện trường', style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Tự động gợi ý camera gần vị trí tin báo — không tự xem/tải video, chỉ tạo yêu cầu '
              'gửi đơn vị quản lý xử lý thủ công.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator()));
                }
                if (snapshot.hasError) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Không tải được camera gần đây.'),
                      TextButton(onPressed: _retry, child: const Text('Thử lại')),
                    ],
                  );
                }
                final cameras = snapshot.data ?? const [];
                if (cameras.isEmpty) {
                  return const Text('Không có camera nào được ghi nhận gần vị trí này.');
                }
                return Column(
                  children: cameras.map((camera) {
                    final distance = (camera['distanceMeters'] as num?)?.round();
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(camera['name'] as String? ?? 'Camera'),
                      subtitle: Text(
                        '${camera['managingUnitName'] ?? 'Không rõ đơn vị'} — '
                        '${camera['managingUnitContact'] ?? ''}'
                        '${distance != null ? ' • cách ${distance}m' : ''}',
                      ),
                      trailing: TextButton(
                        onPressed: () => _requestExtraction(camera),
                        child: const Text('Xin trích xuất'),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
            if (_feedback != null) ...[
              const SizedBox(height: 8),
              Text(_feedback!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}
