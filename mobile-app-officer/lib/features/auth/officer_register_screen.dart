import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';

/// No CCCD photo upload here (unlike citizen registration) — product decision: officer
/// registration takes a text CCCD number only, and an admin manually reviews/approves before
/// the account can log in at all.
class OfficerRegisterScreen extends ConsumerStatefulWidget {
  const OfficerRegisterScreen({super.key});

  @override
  ConsumerState<OfficerRegisterScreen> createState() =>
      _OfficerRegisterScreenState();
}

class _OfficerRegisterScreenState extends ConsumerState<OfficerRegisterScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _cccdController = TextEditingController();
  final _addressController = TextEditingController();

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _phoneController.dispose();
    _cccdController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final fullName = _fullNameController.text.trim();
    final phoneNumber = _phoneController.text.trim();
    final cccdNumber = _cccdController.text.trim();
    final address = _addressController.text.trim();

    if (!RegExp(r'^[a-zA-Z0-9_]{4,32}$').hasMatch(username)) {
      setState(() => _error =
          'Tên đăng nhập phải 4-32 ký tự, chỉ gồm chữ, số và dấu gạch dưới.');
      return;
    }
    if (password.length < 8) {
      setState(() => _error = 'Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (fullName.isEmpty) {
      setState(() => _error = 'Vui lòng nhập họ tên.');
      return;
    }
    if (!RegExp(r'^0\d{9}$').hasMatch(phoneNumber)) {
      setState(() => _error = 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0.');
      return;
    }
    if (!RegExp(r'^\d{9}$|^\d{12}$').hasMatch(cccdNumber)) {
      setState(() => _error = 'Số CCCD/CMND không hợp lệ.');
      return;
    }
    if (address.isEmpty) {
      setState(() => _error = 'Vui lòng nhập địa chỉ.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(officerRegistrationRepositoryProvider).registerOfficer(
            username: username,
            password: password,
            fullName: fullName,
            phoneNumber: phoneNumber,
            cccdNumber: cccdNumber,
            address: address,
          );
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Đã gửi yêu cầu đăng ký'),
          content: const Text(
            'Tài khoản của bạn đang chờ quản trị viên duyệt. Vui lòng quay lại đăng nhập sau khi được duyệt.',
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Đã hiểu')),
          ],
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
    } on DioException catch (e) {
      final code = (e.response?.data is Map)
          ? (e.response?.data['error']?['code'] as String?)
          : null;
      setState(() {
        _error = code == 'USERNAME_TAKEN'
            ? 'Tên đăng nhập đã được sử dụng.'
            : code == 'PHONE_ALREADY_REGISTERED'
                ? 'Số điện thoại này đã có tài khoản. Vui lòng đăng nhập bằng OTP hoặc liên hệ quản trị viên.'
                : 'Đăng ký thất bại, vui lòng thử lại.';
      });
    } catch (_) {
      setState(() => _error = 'Đăng ký thất bại, vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đăng ký tài khoản cán bộ')),
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
                    controller: _usernameController,
                    decoration:
                        const InputDecoration(labelText: 'Tên đăng nhập'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                        labelText: 'Mật khẩu (tối thiểu 8 ký tự)'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _fullNameController,
                    decoration: const InputDecoration(labelText: 'Họ và tên'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    maxLength: 10,
                    decoration: const InputDecoration(
                        labelText: 'Số điện thoại', counterText: ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _cccdController,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Số CCCD/CMND'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _addressController,
                    decoration:
                        const InputDecoration(labelText: 'Địa chỉ thường trú'),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Gửi yêu cầu đăng ký'),
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
