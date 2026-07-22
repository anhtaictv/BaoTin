import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/providers.dart';
import '../../home_shell.dart';

class CitizenRegisterScreen extends ConsumerStatefulWidget {
  const CitizenRegisterScreen({super.key});

  @override
  ConsumerState<CitizenRegisterScreen> createState() => _CitizenRegisterScreenState();
}

class _CitizenRegisterScreenState extends ConsumerState<CitizenRegisterScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _cccdController = TextEditingController();
  final _addressController = TextEditingController();

  Uint8List? _cccdFrontBytes;
  String? _cccdFrontFilename;
  Uint8List? _cccdBackBytes;
  String? _cccdBackFilename;
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

  Future<void> _pickCccdPhoto({required bool isFront}) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (_) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Chụp ảnh'),
              onTap: () => Navigator.of(context).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Chọn từ thư viện'),
              onTap: () => Navigator.of(context).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    final capture = ref.read(cameraGpsCaptureProvider);
    final photo =
        source == ImageSource.camera ? await capture.captureFromCamera() : await capture.pickFromGallery();
    if (photo == null) return;
    final bytes = await photo.readAsBytes();
    setState(() {
      if (isFront) {
        _cccdFrontBytes = bytes;
        _cccdFrontFilename = photo.name;
      } else {
        _cccdBackBytes = bytes;
        _cccdBackFilename = photo.name;
      }
    });
  }

  Future<void> _submit() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final fullName = _fullNameController.text.trim();
    final phoneNumber = _phoneController.text.trim();
    final cccdNumber = _cccdController.text.trim();
    final address = _addressController.text.trim();

    if (!RegExp(r'^[a-zA-Z0-9_]{4,32}$').hasMatch(username)) {
      setState(() => _error = 'Tên đăng nhập phải 4-32 ký tự, chỉ gồm chữ, số và dấu gạch dưới.');
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
    if (_cccdFrontBytes == null || _cccdBackBytes == null) {
      setState(() => _error = 'Vui lòng chụp đủ ảnh CCCD mặt trước và mặt sau.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(registrationRepositoryProvider).registerCitizen(
            username: username,
            password: password,
            fullName: fullName,
            phoneNumber: phoneNumber,
            cccdNumber: cccdNumber,
            address: address,
            cccdFrontBytes: _cccdFrontBytes!,
            cccdFrontFilename: _cccdFrontFilename!,
            cccdBackBytes: _cccdBackBytes!,
            cccdBackFilename: _cccdBackFilename!,
          );
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (route) => false,
      );
    } catch (_) {
      setState(() => _error = 'Đăng ký thất bại — tên đăng nhập/số điện thoại có thể đã được sử dụng.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _cccdPhotoTile({required String label, required Uint8List? bytes, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 110,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade400),
        ),
        child: bytes == null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.add_a_photo_outlined),
                    const SizedBox(height: 4),
                    Text(label, style: const TextStyle(fontSize: 12)),
                  ],
                ),
              )
            : ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(bytes, fit: BoxFit.cover, width: double.infinity),
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đăng ký tài khoản')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _usernameController,
                decoration: const InputDecoration(labelText: 'Tên đăng nhập'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu (tối thiểu 8 ký tự)'),
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
                decoration: const InputDecoration(labelText: 'Số điện thoại', counterText: ''),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _cccdController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Số CCCD/CMND'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _addressController,
                decoration: const InputDecoration(labelText: 'Địa chỉ thường trú'),
              ),
              const SizedBox(height: 16),
              Text('Ảnh CCCD', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _cccdPhotoTile(
                      label: 'Mặt trước',
                      bytes: _cccdFrontBytes,
                      onTap: () => _pickCccdPhoto(isFront: true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _cccdPhotoTile(
                      label: 'Mặt sau',
                      bytes: _cccdBackBytes,
                      onTap: () => _pickCccdPhoto(isFront: false),
                    ),
                  ),
                ],
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
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Đăng ký'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
