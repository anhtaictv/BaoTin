import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../home_shell.dart';
import 'citizen_register_screen.dart';
import 'otp_request_screen.dart';

/// App entry point when no token is stored — username/password login (the new registered-
/// account flow), with an escape hatch to the pre-existing OTP flow for anyone who hasn't
/// registered yet and just wants to file a quick report.
class CitizenLoginScreen extends ConsumerStatefulWidget {
  const CitizenLoginScreen({super.key});

  @override
  ConsumerState<CitizenLoginScreen> createState() => _CitizenLoginScreenState();
}

class _CitizenLoginScreenState extends ConsumerState<CitizenLoginScreen> {
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
      await ref.read(registrationRepositoryProvider).loginCitizen(username: username, password: password);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (route) => false,
      );
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
              Icon(Icons.shield_outlined, size: 56, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              Text(
                'Báo Tin',
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
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Đăng nhập'),
              ),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const CitizenRegisterScreen()),
                        ),
                child: const Text('Chưa có tài khoản? Đăng ký'),
              ),
              const Divider(height: 32),
              TextButton(
                onPressed: _submitting
                    ? null
                    : () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const OtpRequestScreen()),
                        ),
                child: const Text('Báo tin nhanh bằng SĐT + OTP (không cần đăng ký)'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
