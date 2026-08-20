import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import 'emergency_queue.dart';

const _emergencyTypes = <String, IconData>{
  'chay_no': Icons.local_fire_department,
  'tai_nan': Icons.car_crash,
  'an_ninh_khan_cap': Icons.warning_amber_rounded,
  'khac': Icons.emergency_outlined,
};

const _emergencyLabels = <String, String>{
  'chay_no': 'Cháy nổ',
  'tai_nan': 'Tai nạn',
  'an_ninh_khan_cap': 'An ninh khẩn cấp',
  'khac': 'Khác',
};

/// Deliberately the simplest screen in the app: one tap to pick emergency type, one tap
/// to send. No photo, no description, no multi-step form — API_SPEC.md requires this path
/// to prioritize speed above everything else. Pushed as a full-screen route (home_shell.dart's
/// SOS dot), so it needs its own explicit close affordance — an AppBar close button, not just
/// an assumed swipe/back gesture (anh, 2026-07-22: "vào không có nút tắt sos").
class SosScreen extends ConsumerStatefulWidget {
  const SosScreen({super.key});

  @override
  ConsumerState<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends ConsumerState<SosScreen> {
  bool _sending = false;
  String? _sentReportId;
  String? _error;

  Future<void> _sendEmergency(String emergencyType) async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final location = await ref.read(locationResolverProvider).resolveFromDevice();
      if (location == null) {
        setState(() => _error = 'Không lấy được vị trí. Hãy bật định vị và thử lại.');
        return;
      }

      const uuid = Uuid();
      final clientRequestId = uuid.v4();
      final repo = ref.read(emergencyRepositoryProvider);
      final queue = ref.read(emergencyQueueProvider);

      try {
        // Attempt 1: try to send immediately
        final reportId = await repo.createEmergencyReport(
          emergencyType: emergencyType,
          lat: location.lat,
          lng: location.lng,
          clientRequestId: clientRequestId,
        );
        setState(() => _sentReportId = reportId);
      } catch (_) {
        // Attempt 2: auto-retry once
        try {
          final reportId = await repo.createEmergencyReport(
            emergencyType: emergencyType,
            lat: location.lat,
            lng: location.lng,
            clientRequestId: clientRequestId,
          );
          setState(() => _sentReportId = reportId);
        } catch (_) {
          // Both attempts failed — queue for later
          await queue.enqueue(QueuedEmergency(
            id: clientRequestId,
            emergencyType: emergencyType,
            lat: location.lat,
            lng: location.lng,
            createdAt: DateTime.now(),
          ));
          if (mounted) {
            setState(() {
              _sentReportId = clientRequestId;
              _error = 'Đã lưu — sẽ gửi ngay khi có mạng';
            });
          }
        }
      }
    } catch (_) {
      setState(() => _error = 'Không thể lấy vị trí — vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_sentReportId != null) {
      return Scaffold(
        backgroundColor: BaoTinTheme.emergency,
        appBar: AppBar(
          backgroundColor: BaoTinTheme.emergency,
          foregroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 56),
                  const SizedBox(height: 16),
                  const Text(
                    'Đã gửi tin báo cấp cứu!',
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Cán bộ phụ trách địa bàn đã được thông báo ngay lập tức.',
                    style: TextStyle(color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: BaoTinTheme.emergency),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Đóng'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cấp cứu / SOS'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Chọn loại tình huống khẩn cấp',
                    style: Theme.of(context).textTheme.titleMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Chạm một lần để gửi ngay — vị trí của bạn sẽ được gửi kèm tự động.',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.1,
                    children: _emergencyTypes.entries.map((entry) {
                      return _EmergencyButton(
                        icon: entry.value,
                        label: _emergencyLabels[entry.key]!,
                        disabled: _sending,
                        onTap: () => _sendEmergency(entry.key),
                      );
                    }).toList(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                  ],
                  if (_sending) ...[
                    const SizedBox(height: 16),
                    const Center(child: CircularProgressIndicator(color: BaoTinTheme.emergency)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EmergencyButton extends StatelessWidget {
  const _EmergencyButton({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.disabled,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BaoTinTheme.emergency,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: disabled ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 32),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
