import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../home_shell.dart';

/// Self-service password change — every officer account, not just admin. Reached from
/// admin_menu_screen.dart alongside the actually-admin-only screens; this tile itself has no
/// role restriction, backend enforces "only your own account" via the JWT (never a body id).
///
/// Also reused as the FORCED first-login gate for `web_accounts` (102-xã admin-provisioned
/// accounts, see web_account_repository.dart): [forWebAccount] picks the endpoint
/// (/web-accounts/me/password vs /auth/officer/change-password), [forced] hides the back
/// button and routes to HomeShell instead of popping on success. Unlike dashboard-web-react's
/// ChangePasswordGate, this only checks mustChangePassword once at login, not on every screen
/// — ponytail: acceptable one-time gate, not re-checked mid-session; revisit if a temp
/// password needs to be revocable while the officer is already inside the app.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key, this.forWebAccount = false, this.forced = false});

  final bool forWebAccount;
  final bool forced;

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _oldPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final oldPassword = _oldPasswordController.text;
    final newPassword = _newPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (oldPassword.isEmpty) {
      setState(() => _error = 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 8) {
      setState(() => _error = 'Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword != confirmPassword) {
      setState(() => _error = 'Mật khẩu mới nhập lại không khớp.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      if (widget.forWebAccount) {
        await ref.read(webAccountRepositoryProvider).changePassword(
              oldPassword: oldPassword,
              newPassword: newPassword,
            );
      } else {
        await ref.read(officerRegistrationRepositoryProvider).changePassword(
              oldPassword: oldPassword,
              newPassword: newPassword,
            );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã đổi mật khẩu.')),
      );
      if (widget.forced) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeShell()),
          (route) => false,
        );
      } else {
        Navigator.of(context).pop();
      }
    } on DioException catch (e) {
      final code = (e.response?.data is Map) ? (e.response?.data['error']?['code'] as String?) : null;
      setState(() {
        _error = switch (code) {
          'INVALID_CREDENTIALS' => 'Mật khẩu hiện tại không đúng.',
          'NO_PASSWORD_SET' => 'Tài khoản này đang đăng nhập bằng OTP, chưa có mật khẩu để đổi.',
          _ => 'Đổi mật khẩu thất bại, thử lại sau.',
        };
      });
    } catch (_) {
      setState(() => _error = 'Đổi mật khẩu thất bại, thử lại sau.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !widget.forced,
      child: Scaffold(
      appBar: AppBar(
        title: const Text('Đổi mật khẩu'),
        automaticallyImplyLeading: !widget.forced,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.forced) ...[
                    const Text(
                      'Tài khoản đang dùng mật khẩu tạm — vui lòng đổi mật khẩu trước khi tiếp tục.',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _oldPasswordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _newPasswordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Mật khẩu mới (tối thiểu 8 ký tự)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Nhập lại mật khẩu mới'),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Đổi mật khẩu'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      ),
    );
  }
}
