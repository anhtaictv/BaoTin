import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';

/// Self-service password change — reached from profile_screen.dart. Works even for an
/// account auto-locked by repeated false reports; the lock only blocks new normal report
/// submissions, not account management.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

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
      await ref.read(registrationRepositoryProvider).changePassword(
            oldPassword: oldPassword,
            newPassword: newPassword,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã đổi mật khẩu.')),
      );
      Navigator.of(context).pop();
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
    return Scaffold(
      appBar: AppBar(title: const Text('Đổi mật khẩu')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
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
    );
  }
}
