import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../home_shell.dart';
import 'officer_login_screen.dart';
import 'officer_register_screen.dart';

/// App entry point when no token is stored — username/password login (the new self-
/// registration flow), with an escape hatch to the pre-existing OTP login for
/// already-provisioned officers.
class OfficerPasswordLoginScreen extends ConsumerStatefulWidget {
  const OfficerPasswordLoginScreen({super.key});

  @override
  ConsumerState<OfficerPasswordLoginScreen> createState() => _OfficerPasswordLoginScreenState();
}

class _OfficerPasswordLoginScreenState extends ConsumerState<OfficerPasswordLoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(officerRegistrationRepositoryProvider).loginOfficer(username: username, password: password);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (route) => false,
      );
    } on DioException catch (e) {
      final code =
          (e.response?.data is Map) ? (e.response?.data['error']?['code'] as String?) : null;
      setState(() {
        _error = switch (code) {
          'APPROVAL_PENDING' => 'Tài khoản đang chờ quản trị viên duyệt.',
          'APPROVAL_REJECTED' => 'Tài khoản đã bị từ chối. Vui lòng liên hệ quản trị viên.',
          _ => 'Sai tên đăng nhập hoặc mật khẩu.',
        };
      });
    } catch (_) {
      setState(() => _error = 'Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.local_police_outlined, size: 56, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              Text(
                'Báo Tin — Cán bộ',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _usernameController,
                decoration: const InputDecoration(labelText: 'Tên đăng nhập'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Đăng nhập'),
              ),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () => Navigator.of(context)
                        .push(MaterialPageRoute(builder: (_) => const OfficerRegisterScreen())),
                child: const Text('Chưa có tài khoản? Đăng ký (chờ admin duyệt)'),
              ),
              const Divider(height: 32),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () =>
                        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OfficerLoginScreen())),
                child: const Text('Đăng nhập bằng SĐT + OTP (tài khoản đã được cấp)'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
