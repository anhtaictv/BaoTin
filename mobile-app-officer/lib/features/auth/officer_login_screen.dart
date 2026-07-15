import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'officer_otp_verify_screen.dart';

class OfficerLoginScreen extends ConsumerStatefulWidget {
  const OfficerLoginScreen({super.key});

  @override
  ConsumerState<OfficerLoginScreen> createState() => _OfficerLoginScreenState();
}

class _OfficerLoginScreenState extends ConsumerState<OfficerLoginScreen> {
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
      final devOtp = await ref.read(officerAuthRepositoryProvider).requestOtp(phoneNumber);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => OfficerOtpVerifyScreen(phoneNumber: phoneNumber, devOtp: devOtp)),
      );
    } catch (_) {
      // Deliberately generic — backend also never reveals whether a phone number is a
      // provisioned officer account (auth.service.ts officerLogin).
      setState(() => _error = 'Không thể đăng nhập với số điện thoại này.');
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
              const SizedBox(height: 8),
              Text(
                'Đăng nhập bằng số điện thoại đã được cấp.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: const InputDecoration(labelText: 'Số điện thoại', counterText: ''),
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
                    : const Text('Gửi mã OTP'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
