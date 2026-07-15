import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import 'dashboard_otp_verify_screen.dart';

class DashboardLoginScreen extends ConsumerStatefulWidget {
  const DashboardLoginScreen({super.key});

  @override
  ConsumerState<DashboardLoginScreen> createState() => _DashboardLoginScreenState();
}

class _DashboardLoginScreenState extends ConsumerState<DashboardLoginScreen> {
  final _phoneController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phoneNumber = _phoneController.text.trim();
    if (!RegExp(r'^0\d{9}$').hasMatch(phoneNumber)) {
      setState(() => _error = 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final devOtp = await ref.read(dashboardAuthRepositoryProvider).requestOtp(phoneNumber);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DashboardOtpVerifyScreen(phoneNumber: phoneNumber, devOtp: devOtp)),
      );
    } catch (_) {
      setState(() => _error = 'Không thể đăng nhập với số điện thoại này.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.dashboard_outlined, size: 40, color: DashboardTheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Báo Tin — Trung tâm điều hành',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Dành cho quản trị / cán bộ cấp trên',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    maxLength: 10,
                    decoration: const InputDecoration(labelText: 'Số điện thoại', counterText: ''),
                    onSubmitted: (_) => _submit(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Gửi mã OTP'),
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
