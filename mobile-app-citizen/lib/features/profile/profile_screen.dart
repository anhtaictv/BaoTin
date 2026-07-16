import 'package:flutter/material.dart';
import '../identity_verification/nfc_cccd_mock_screen.dart';

/// Giai đoạn 4 — liên kết CCCD (mô phỏng) để tăng độ tin cậy tài khoản, giảm tin báo ảo.
/// Trạng thái "đã liên kết" chỉ giữ trong bộ nhớ màn hình (không có field nào ở backend cho
/// việc này) — đúng tinh thần "mock UI trước" của CLAUDE.md #5, chưa phải tính năng thật.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _cccdLinked = false;

  Future<void> _linkCccd() async {
    final confirmed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const NfcCccdMockScreen()),
    );
    if (confirmed == true && mounted) {
      setState(() => _cccdLinked = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: Icon(
                _cccdLinked ? Icons.verified_user : Icons.badge_outlined,
                color: _cccdLinked ? Colors.green.shade700 : null,
              ),
              title: const Text('Liên kết CCCD'),
              subtitle: Text(
                _cccdLinked
                    ? 'Đã liên kết (mô phỏng) — tăng độ tin cậy tài khoản.'
                    : 'Chưa liên kết. Liên kết để tin báo của bạn được ưu tiên xem xét hơn.',
              ),
              trailing: _cccdLinked
                  ? const Icon(Icons.check_circle, color: Colors.green)
                  : TextButton(onPressed: _linkCccd, child: const Text('Liên kết')),
            ),
          ),
        ],
      ),
    );
  }
}
