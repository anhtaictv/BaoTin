import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../reports_list/report_list_screen.dart';

class OfficerOtpVerifyScreen extends ConsumerStatefulWidget {
  const OfficerOtpVerifyScreen({super.key, required this.phoneNumber, this.devOtp});

  final String phoneNumber;
  final String? devOtp;

  @override
  ConsumerState<OfficerOtpVerifyScreen> createState() => _OfficerOtpVerifyScreenState();
}

class _OfficerOtpVerifyScreenState extends ConsumerState<OfficerOtpVerifyScreen> {
  final _otpController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.devOtp != null) _otpController.text = widget.devOtp!;
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final otp = _otpController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      setState(() => _error = 'Mã OTP phải gồm 6 số.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(officerAuthRepositoryProvider).verifyOtp(phoneNumber: widget.phoneNumber, otp: otp);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const ReportListScreen()),
        (route) => false,
      );
    } catch (_) {
      setState(() => _error = 'Mã OTP không đúng hoặc đã hết hạn.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Xác thực OTP')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Text('Nhập mã OTP đã gửi tới ${widget.phoneNumber}'),
              const SizedBox(height: 16),
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                autofocus: true,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, letterSpacing: 8),
                decoration: const InputDecoration(counterText: ''),
              ),
              if (widget.devOtp != null)
                Text('(Chế độ dev: mã là ${widget.devOtp})', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Xác nhận'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
