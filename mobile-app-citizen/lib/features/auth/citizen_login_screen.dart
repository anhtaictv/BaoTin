import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/bao_tin_badge.dart';
import '../../core/providers.dart';
import '../../core/responsive.dart';
import '../../core/theme.dart';
import '../../home_shell.dart';
import 'citizen_register_screen.dart';
import 'otp_request_screen.dart';

/// App entry point when no token is stored — username/password login (the new registered-
/// account flow), with an escape hatch to the pre-existing OTP flow for anyone who hasn't
/// registered yet and just wants to file a quick report. Adaptive: stacked hero-over-form on
/// a phone, split hero-beside-form on a desktop browser (anh, 2026-07-22 — a real website
/// layout, not a phone screen stretched/boxed into a wide window).
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
      setState(
          () => _error = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref
          .read(registrationRepositoryProvider)
          .loginCitizen(username: username, password: password);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (route) => false,
      );
    } on DioException catch (e) {
      // No response (offline/timeout/DNS) and 429 (rate-limited) both used to collapse into
      // "sai mật khẩu" below — indistinguishable from an actual wrong password.
      if (e.response == null) {
        setState(() => _error =
            'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
        return;
      }
      final code = (e.response?.data is Map)
          ? (e.response?.data['error']?['code'] as String?)
          : null;
      setState(() {
        _error = code == 'LOGIN_RATE_LIMITED'
            ? 'Đăng nhập sai quá nhiều lần, thử lại sau.'
            : 'Sai tên đăng nhập hoặc mật khẩu.';
      });
    } catch (_) {
      setState(() => _error = 'Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _hero({required bool tall}) {
    return Container(
      padding: EdgeInsets.symmetric(vertical: tall ? 0 : 36),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [BaoTinTheme.heroGreenDark, BaoTinTheme.heroGreenLight],
        ),
      ),
      alignment: Alignment.center,
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BaoTinBadge(size: 108),
          SizedBox(height: 20),
          Text(
            'KÊNH PHẢN ỨNG NHANH',
            textAlign: TextAlign.center,
            style: TextStyle(
                color: BaoTinTheme.gold,
                fontWeight: FontWeight.w800,
                fontSize: 15,
                letterSpacing: 1),
          ),
          SizedBox(height: 4),
          Text(
            'An ninh trật tự tại chỗ',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _form() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _usernameController,
          decoration: const InputDecoration(
              labelText: 'Tên đăng nhập',
              prefixIcon: Icon(Icons.person_outline)),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _passwordController,
          obscureText: true,
          decoration: const InputDecoration(
              labelText: 'Mật khẩu', prefixIcon: Icon(Icons.lock_outline)),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: Colors.red)),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Text('Đăng nhập'),
        ),
        TextButton(
          onPressed: _submitting
              ? null
              : () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const CitizenRegisterScreen())),
          child: const Text('Chưa có tài khoản? Đăng ký'),
        ),
        const Divider(height: 32),
        TextButton(
          onPressed: _submitting
              ? null
              : () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const OtpRequestScreen())),
          child: const Text('Báo tin nhanh bằng SĐT + OTP (không cần đăng ký)'),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (isWideScreen(context)) {
      return Scaffold(
        backgroundColor: BaoTinTheme.heroCream,
        body: Row(
          children: [
            Expanded(child: _hero(tall: true)),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 380),
                    child: _form(),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: BaoTinTheme.heroCream,
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: IntrinsicHeight(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _hero(tall: false),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                          child: Center(child: _form()),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
