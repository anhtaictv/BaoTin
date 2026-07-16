import 'package:flutter/material.dart';

/// Giai đoạn 4 "Quét NFC CCCD" — CLAUDE.md non-negotiable #5: KHÔNG tự đọc chip NFC CCCD.
/// Toàn bộ màn hình này là mô phỏng giao diện, không có bất kỳ lời gọi NFC/chip thật nào —
/// mọi dữ liệu hiển thị đều gắn nhãn [MOCK] rõ ràng. Tích hợp thật (nếu làm sau) phải qua
/// VNeID/SDK chính thức của Bộ Công an.
class NfcCccdMockScreen extends StatefulWidget {
  const NfcCccdMockScreen({super.key});

  @override
  State<NfcCccdMockScreen> createState() => _NfcCccdMockScreenState();
}

class _NfcCccdMockScreenState extends State<NfcCccdMockScreen> {
  bool _scanning = true;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _scanning = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Liên kết CCCD (mô phỏng)')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: _scanning ? _buildScanning(context) : _buildResult(context),
      ),
    );
  }

  Widget _buildScanning(BuildContext context) {
    return const Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.nfc, size: 72, color: Colors.blueGrey),
        SizedBox(height: 16),
        CircularProgressIndicator(),
        SizedBox(height: 16),
        Text('Đang mô phỏng quét NFC — đưa thẻ CCCD lại gần mặt sau điện thoại...'),
      ],
    );
  }

  Widget _buildResult(BuildContext context) {
    return ListView(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.amber.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.amber.shade200),
          ),
          child: const Text(
            'Đây là giao diện mô phỏng — chưa đọc chip CCCD thật. Tích hợp thật cần qua '
            'VNeID/SDK chính thức của Bộ Công an, không tự parse chip (CLAUDE.md #5).',
            style: TextStyle(fontSize: 12.5),
          ),
        ),
        const SizedBox(height: 20),
        const Icon(Icons.badge_outlined, size: 56, color: Colors.blueGrey),
        const SizedBox(height: 16),
        const _MockField(label: 'Họ tên', value: '[MOCK] Nguyễn Văn A'),
        const _MockField(label: 'Số CCCD', value: '[MOCK] 041099012345'),
        const _MockField(label: 'Ngày sinh', value: '[MOCK] 01/01/1999'),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Xác nhận liên kết CCCD'),
        ),
        const SizedBox(height: 8),
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Huỷ')),
      ],
    );
  }
}

class _MockField extends StatelessWidget {
  const _MockField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(width: 100, child: Text(label, style: TextStyle(color: Colors.grey.shade600))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
