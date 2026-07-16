import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../dashboard/dashboard_screen.dart';

const _resendCooldownSeconds = 30;

class DashboardOtpVerifyScreen extends ConsumerStatefulWidget {
  const DashboardOtpVerifyScreen({super.key, required this.phoneNumber, this.devOtp});

  final String phoneNumber;
  final String? devOtp;

  @override
  ConsumerState<DashboardOtpVerifyScreen> createState() => _DashboardOtpVerifyScreenState();
}

class _DashboardOtpVerifyScreenState extends ConsumerState<DashboardOtpVerifyScreen> {
  final _otpController = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _devOtp;
  bool _resending = false;
  int _resendCooldown = _resendCooldownSeconds;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    _devOtp = widget.devOtp;
    if (widget.devOtp != null) _otpController.text = widget.devOtp!;
    _startCooldown();
  }

  @override
  void dispose() {
    _otpController.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _resendCooldown = _resendCooldownSeconds);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_resendCooldown <= 1) {
        timer.cancel();
        setState(() => _resendCooldown = 0);
        return;
      }
      setState(() => _resendCooldown -= 1);
    });
  }

  Future<void> _resendOtp() async {
    setState(() => _resending = true);
    try {
      final devOtp = await ref.read(dashboardAuthRepositoryProvider).requestOtp(widget.phoneNumber);
      if (!mounted) return;
      setState(() {
        _devOtp = devOtp;
        _error = null;
      });
      _startCooldown();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Không gửi lại được mã OTP. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _resending = false);
    }
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
      await ref.read(dashboardAuthRepositoryProvider).verifyOtp(phoneNumber: widget.phoneNumber, otp: otp);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const DashboardScreen()),
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
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
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
                  onSubmitted: (_) => _submit(),
                ),
                if (_devOtp != null)
                  Text('(Chế độ dev: mã là $_devOtp)', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Xác nhận'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: (_resendCooldown > 0 || _resending) ? null : _resendOtp,
                  child: _resending
                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(_resendCooldown > 0 ? 'Gửi lại mã ($_resendCooldown s)' : 'Gửi lại mã'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
