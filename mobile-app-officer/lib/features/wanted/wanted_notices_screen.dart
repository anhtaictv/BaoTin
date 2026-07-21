import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';

/// "Lệnh truy nã" — any officer account can view (backend requireAuth([])); posting is
/// senior_officer/admin only. No client-side role check exists elsewhere in this app (every
/// screen just calls the endpoint and lets a 403 fail, see overview_screen.dart) — same here:
/// the FAB is always shown, and a plain "officer" tapping it gets a clear message from the
/// 403 instead of the backend's generic one.
class WantedNoticesScreen extends ConsumerStatefulWidget {
  const WantedNoticesScreen({super.key});

  @override
  ConsumerState<WantedNoticesScreen> createState() => _WantedNoticesScreenState();
}

class _WantedNoticesScreenState extends ConsumerState<WantedNoticesScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _future = ref.read(wantedNoticesRepositoryProvider).list();
  }

  void _refresh() => setState(() {
        _future = ref.read(wantedNoticesRepositoryProvider).list();
      });

  Future<void> _pickAndUpload(ImageSource source) async {
    final photo = await ImagePicker().pickImage(source: source);
    if (photo == null) return;
    final bytes = await photo.readAsBytes();

    setState(() => _uploading = true);
    try {
      await ref.read(wantedNoticesRepositoryProvider).post(bytes: bytes, filename: photo.name);
      if (!mounted) return;
      _refresh();
    } on DioException catch (e) {
      if (!mounted) return;
      final message = e.response?.statusCode == 403
          ? 'Chỉ cán bộ quản lý mới được đăng lệnh truy nã.'
          : 'Đăng lệnh truy nã thất bại, thử lại sau.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _openFullPhoto(String url) {
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: InteractiveViewer(child: Image.network(url, fit: BoxFit.contain)),
      ),
    );
  }

  void _showUploadSourcePicker() {
    showModalBottomSheet<void>(
      context: context,
      builder: (_) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Chụp ảnh'),
              onTap: () {
                Navigator.of(context).pop();
                _pickAndUpload(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Chọn từ thư viện'),
              onTap: () {
                Navigator.of(context).pop();
                _pickAndUpload(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Lệnh truy nã')),
      floatingActionButton: FloatingActionButton(
        onPressed: _uploading ? null : _showUploadSourcePicker,
        child: _uploading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.add_a_photo_outlined),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await _future;
        },
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            final notices = snapshot.data ?? const [];
            if (notices.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.badge_outlined, size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Chưa có lệnh truy nã nào.', style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            return GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.85,
              ),
              itemCount: notices.length,
              itemBuilder: (context, index) {
                final notice = notices[index];
                final url = notice['photoUrl'] as String;
                return InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => _openFullPhoto(url),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(url, fit: BoxFit.cover),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _formatDate(notice['createdAt'] as String?),
                        style: TextStyle(fontSize: 11, color: colors.onSurfaceVariant),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM/yyyy').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
