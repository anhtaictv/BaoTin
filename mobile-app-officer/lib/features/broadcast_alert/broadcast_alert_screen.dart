import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';

/// Geo-fence alert (cảnh báo ngược từ cán bộ, theo địa bàn/phường) — form đơn giản: chọn địa
/// bàn (chỉ hiện khi có >1 lựa chọn — một officer thường/phổ biến chỉ có đúng 1 phân công đang
/// active), nội dung, mức độ khẩn cấp. Không có upload ảnh nên đơn giản hơn form lệnh truy nã.
class BroadcastAlertScreen extends ConsumerStatefulWidget {
  const BroadcastAlertScreen({super.key});

  @override
  ConsumerState<BroadcastAlertScreen> createState() => _BroadcastAlertScreenState();
}

class _BroadcastAlertScreenState extends ConsumerState<BroadcastAlertScreen> {
  final _messageController = TextEditingController();
  late Future<List<Map<String, dynamic>>> _districtsFuture;
  String? _selectedDistrictId;
  String _urgency = 'normal';
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _districtsFuture = ref.read(broadcastAlertRepositoryProvider).listDistricts();
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final districtId = _selectedDistrictId;
    if (districtId == null) {
      setState(() => _error = 'Hãy chọn địa bàn cần gửi cảnh báo.');
      return;
    }
    if (_messageController.text.trim().isEmpty) {
      setState(() => _error = 'Hãy nhập nội dung cảnh báo.');
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(broadcastAlertRepositoryProvider).send(
            districtId: districtId,
            message: _messageController.text.trim(),
            urgency: _urgency,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi cảnh báo tới người dân trong địa bàn.')),
      );
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Gửi cảnh báo thất bại. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gửi cảnh báo khu vực')),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _districtsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final districts = snapshot.data ?? const [];
          if (snapshot.hasError || districts.isEmpty) {
            return const Center(child: Text('Không có địa bàn nào để gửi cảnh báo.'));
          }
          _selectedDistrictId ??= districts.length == 1 ? districts.first['id'] as String? : null;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Cảnh báo sẽ được gửi tới người dân từng báo tin trong địa bàn được chọn, '
                'và hiển thị trong mục "Khu vực" của app người dân.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              if (districts.length > 1) ...[
                Text('Địa bàn', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _selectedDistrictId,
                  items: [
                    for (final d in districts)
                      DropdownMenuItem(value: d['id'] as String, child: Text(d['tenXa'] as String? ?? '')),
                  ],
                  onChanged: (value) => setState(() => _selectedDistrictId = value),
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                ),
                const SizedBox(height: 16),
              ] else if (districts.length == 1) ...[
                Text('Địa bàn', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(districts.first['tenXa'] as String? ?? ''),
                const SizedBox(height: 16),
              ],
              Text('Mức độ', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('Bình thường'),
                    selected: _urgency == 'normal',
                    onSelected: (_) => setState(() => _urgency = 'normal'),
                  ),
                  ChoiceChip(
                    label: const Text('Khẩn cấp'),
                    selected: _urgency == 'emergency',
                    onSelected: (_) => setState(() => _urgency = 'emergency'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text('Nội dung', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              TextField(
                controller: _messageController,
                maxLines: 4,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: 'Vd: Cướp giật gần chợ trung tâm, người dân lưu ý...',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _sending ? null : _send,
                child: _sending
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Gửi cảnh báo'),
              ),
            ],
          );
        },
      ),
    );
  }
}
