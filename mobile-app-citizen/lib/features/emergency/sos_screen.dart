import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

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
/// to prioritize speed above everything else.
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
      final reportId = await ref.read(emergencyRepositoryProvider).createEmergencyReport(
            emergencyType: emergencyType,
            lat: location.lat,
            lng: location.lng,
          );
      setState(() => _sentReportId = reportId);
    } catch (_) {
      setState(() => _error = 'Gửi cấp cứu thất bại — hãy thử lại ngay.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_sentReportId != null) {
      return Scaffold(
        backgroundColor: BaoTinTheme.emergency,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 64),
                  const SizedBox(height: 16),
                  const Text(
                    'Đã gửi tin báo cấp cứu!',
                    style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Cán bộ phụ trách địa bàn đã được thông báo ngay lập tức.',
                    style: TextStyle(color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white),
                    ),
                    onPressed: () => setState(() => _sentReportId = null),
                    child: const Text('Quay lại'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Chọn loại tình huống khẩn cấp',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Chạm một lần để gửi ngay — vị trí của bạn sẽ được gửi kèm tự động.',
                style: TextStyle(color: Colors.grey.shade600),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Expanded(
                child: GridView.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 16,
                  crossAxisSpacing: 16,
                  children: _emergencyTypes.entries.map((entry) {
                    return _EmergencyButton(
                      icon: entry.value,
                      label: _emergencyLabels[entry.key]!,
                      disabled: _sending,
                      onTap: () => _sendEmergency(entry.key),
                    );
                  }).toList(),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
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
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: disabled ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 40),
              const SizedBox(height: 12),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
