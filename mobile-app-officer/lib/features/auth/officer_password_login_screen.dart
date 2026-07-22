import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/bao_tin_badge.dart';
import '../../core/providers.dart';
import '../../core/responsive.dart';
import '../../core/theme.dart';
import '../../home_shell.dart';
import 'officer_login_screen.dart';
import 'officer_register_screen.dart';

/// App entry point when no token is stored — username/password login (the new self-
/// registration flow), with an escape hatch to the pre-existing OTP login for
/// already-provisioned officers. Adaptive: stacked hero-over-form on a phone, split
/// hero-beside-form on a desktop browser (same pattern as mobile-app-citizen's
/// citizen_login_screen.dart).
class OfficerPasswordLoginScreen extends ConsumerStatefulWidget {
  const OfficerPasswordLoginScreen({super.key});

  @override
  ConsumerState<OfficerPasswordLoginScreen> createState() =>
      _OfficerPasswordLoginScreenState();
}

class _OfficerPasswordLoginScreenState
    extends ConsumerState<OfficerPasswordLoginScreen> {
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
          .read(officerRegistrationRepositoryProvider)
          .loginOfficer(username: username, password: password);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (route) => false,
      );
    } on DioException catch (e) {
      // No response at all (timeout/DNS/offline) and 429 (rate-limited) both used to fall
      // through to the generic "sai mật khẩu" branch below — indistinguishable from an actual
      // wrong password, which is exactly what made a real network/rate-limit issue look like a
      // credentials problem when tested against production.
      if (e.response == null) {
        setState(() => _error =
            'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
        return;
      }
      final code = (e.response?.data is Map)
          ? (e.response?.data['error']?['code'] as String?)
          : null;
      setState(() {
        _error = switch (code) {
          'APPROVAL_PENDING' => 'Tài khoản đang chờ quản trị viên duyệt.',
          'APPROVAL_REJECTED' =>
            'Tài khoản đã bị từ chối. Vui lòng liên hệ quản trị viên.',
          'LOGIN_RATE_LIMITED' =>
            'Đăng nhập sai quá nhiều lần, thử lại sau.',
          _ => 'Sai tên đăng nhập hoặc mật khẩu.',
        };
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
          colors: [
            BaoTinOfficerTheme.primaryDark,
            BaoTinOfficerTheme.primaryLight
          ],
        ),
      ),
      alignment: Alignment.center,
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BaoTinBadge(size: 96),
          SizedBox(height: 18),
          Text(
            'BÁO TIN — CÁN BỘ',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: BaoTinOfficerTheme.gold,
              fontWeight: FontWeight.w800,
              fontSize: 15,
              letterSpacing: 1,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Cổng tiếp nhận & xác minh tin báo',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 13),
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
                  builder: (_) => const OfficerRegisterScreen())),
          child: const Text('Chưa có tài khoản? Đăng ký (chờ admin duyệt)'),
        ),
        const Divider(height: 32),
        TextButton(
          onPressed: _submitting
              ? null
              : () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const OfficerLoginScreen())),
          child: const Text('Đăng nhập bằng SĐT + OTP (tài khoản đã được cấp)'),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (isWideScreen(context)) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Row(
          children: [
            Expanded(child: _hero(tall: true)),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 380),
                      child: _form()),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white,
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
