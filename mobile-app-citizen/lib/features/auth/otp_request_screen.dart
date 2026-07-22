import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/bao_tin_badge.dart';
import '../../core/providers.dart';
import 'otp_verify_screen.dart';

class OtpRequestScreen extends ConsumerStatefulWidget {
  const OtpRequestScreen({super.key});

  @override
  ConsumerState<OtpRequestScreen> createState() => _OtpRequestScreenState();
}

class _OtpRequestScreenState extends ConsumerState<OtpRequestScreen> {
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
      final devOtp = await ref.read(authRepositoryProvider).requestOtp(phoneNumber);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OtpVerifyScreen(phoneNumber: phoneNumber, devOtp: devOtp),
        ),
      );
    } catch (_) {
      setState(() => _error = 'Không gửi được mã OTP. Vui lòng thử lại.');
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
              const BaoTinBadge(size: 84),
              const SizedBox(height: 16),
              Text(
                'Báo Tin',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Kênh phản ứng nhanh — báo tin an ninh trật tự tại chỗ.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: const InputDecoration(
                  labelText: 'Số điện thoại',
                  hintText: '09xxxxxxxx',
                  counterText: '',
                ),
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
                    : const Text('Gửi mã OTP'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
