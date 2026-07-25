import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../auth/auth_gate.dart';
import '../auth/change_password_screen.dart';
import '../identity_verification/nfc_cccd_mock_screen.dart';

/// Giai đoạn 4 — liên kết CCCD (mô phỏng) để tăng độ tin cậy tài khoản, giảm tin báo ảo.
/// Trạng thái "đã liên kết" chỉ giữ trong bộ nhớ màn hình (không có field nào ở backend cho
/// việc này) — đúng tinh thần "mock UI trước" của CLAUDE.md #5, chưa phải tính năng thật.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _cccdLinked = false;
  bool _loggingOut = false;

  Future<void> _logout() async {
    setState(() => _loggingOut = true);
    await ref.read(authRepositoryProvider).logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AuthGate()),
      (route) => false,
    );
  }

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
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.password_outlined),
              title: const Text('Đổi mật khẩu'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
              ),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _loggingOut ? null : _logout,
            icon: _loggingOut
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.logout),
            label: const Text('Đăng xuất'),
          ),
        ],
      ),
    );
  }
}
