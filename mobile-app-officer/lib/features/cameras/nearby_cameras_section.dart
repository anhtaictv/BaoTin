import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'extraction_request_dialog.dart';

/// Auto-suggests cameras near a report's location — fetched automatically when this
/// widget mounts (alongside the report detail load), never behind a manual search
/// button. CLAUDE.md non-negotiable #8: only shows name + managing-unit contact; there
/// is no play/preview/download affordance anywhere in this widget.
///
/// Cameras can be selected in bulk (e.g. several along a route an officer wants to trace
/// after an accident) and submitted as one action — but that only ever produces N separate
/// administrative paperwork requests, one per camera's own managing unit. There is no
/// cross-camera recognition/tracking anywhere here: following a person or vehicle across
/// cameras would be biometric surveillance, which needs its own legal basis and belongs in a
/// purpose-built police operational system, not this citizen-facing app (CLAUDE.md #8).
class NearbyCamerasSection extends ConsumerStatefulWidget {
  const NearbyCamerasSection({super.key, required this.reportId});

  final String reportId;

  @override
  ConsumerState<NearbyCamerasSection> createState() => _NearbyCamerasSectionState();
}

class _NearbyCamerasSectionState extends ConsumerState<NearbyCamerasSection> {
  late Future<List<Map<String, dynamic>>> _future;
  String? _feedback;
  final Set<String> _selected = {};

  @override
  void initState() {
    super.initState();
    _future = ref.read(cameraRepositoryProvider).nearbyCameras(widget.reportId);
  }

  void _toggle(String cameraId) {
    setState(() {
      if (_selected.contains(cameraId)) {
        _selected.remove(cameraId);
      } else {
        _selected.add(cameraId);
      }
    });
  }

  Future<void> _requestExtraction(List<Map<String, dynamic>> allCameras) async {
    final selectedCameras = allCameras.where((c) => _selected.contains(c['id'])).toList();
    if (selectedCameras.isEmpty) return;

    final result = await showExtractionRequestDialog(
      context,
      cameraNames: selectedCameras.map((c) => c['name'] as String? ?? 'Camera').toList(),
    );
    if (result == null) return;
    try {
      await ref.read(cameraRepositoryProvider).createExtractionRequest(
            widget.reportId,
            cameraIds: selectedCameras.map((c) => c['id'] as String).toList(),
            timeRangeStart: result.start,
            timeRangeEnd: result.end,
            note: result.note,
          );
      if (!mounted) return;
      setState(() {
        _feedback = selectedCameras.length == 1
            ? 'Đã gửi yêu cầu trích xuất tới đơn vị quản lý camera.'
            : 'Đã gửi ${selectedCameras.length} yêu cầu trích xuất tới các đơn vị quản lý camera liên quan.';
        _selected.clear();
      });
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
              'Hệ thống tự động gợi ý camera gần vị trí tin báo — không tự xem/tải video. '
              'Chọn 1 hoặc nhiều camera (vd. dọc tuyến đường) để tạo yêu cầu gửi từng đơn vị '
              'quản lý xử lý thủ công — hệ thống không nhận diện hay theo dõi qua các camera.',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
            const SizedBox(height: 12),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator()));
                }
                final cameras = snapshot.data ?? const [];
                if (cameras.isEmpty) {
                  return const Text('Không có camera nào được ghi nhận gần vị trí này.');
                }
                return Column(
                  children: [
                    for (final camera in cameras)
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        value: _selected.contains(camera['id']),
                        onChanged: (_) => _toggle(camera['id'] as String),
                        title: Text(camera['name'] as String? ?? 'Camera'),
                        subtitle: Text(
                          '${camera['managingUnitName'] ?? 'Không rõ đơn vị'} — '
                          '${camera['managingUnitContact'] ?? ''}'
                          '${(camera['distanceMeters'] as num?) != null ? ' • cách ${(camera['distanceMeters'] as num).round()}m' : ''}',
                        ),
                      ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton.icon(
                        onPressed: _selected.isEmpty ? null : () => _requestExtraction(cameras),
                        icon: const Icon(Icons.send_outlined, size: 18),
                        label: Text(_selected.isEmpty ? 'Xin trích xuất' : 'Xin trích xuất (${_selected.length})'),
                      ),
                    ),
                  ],
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
