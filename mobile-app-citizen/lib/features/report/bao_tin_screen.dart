import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../profile/profile_screen.dart';
import 'camera_gps_capture.dart';

/// How long to wait after the last keystroke before asking for a category suggestion — avoids
/// firing a request per character while the person is still typing.
const _classifyDebounce = Duration(milliseconds: 800);

class BaoTinScreen extends ConsumerStatefulWidget {
  const BaoTinScreen({super.key});

  @override
  ConsumerState<BaoTinScreen> createState() => _BaoTinScreenState();
}

class _BaoTinScreenState extends ConsumerState<BaoTinScreen> {
  final _descriptionController = TextEditingController();
  String _category = categoryOptions.keys.first;
  Uint8List? _photoBytes;
  String? _photoFilename;
  ResolvedLocation? _location;
  bool _resolvingLocation = false;
  bool _submitting = false;
  String? _error;

  Timer? _classifyDebounceTimer;
  bool _categoryManuallySet = false;
  bool _categoryJustSuggested = false;

  @override
  void dispose() {
    _classifyDebounceTimer?.cancel();
    _descriptionController.dispose();
    super.dispose();
  }

  void _onDescriptionChanged(String text) {
    _classifyDebounceTimer?.cancel();
    if (_categoryManuallySet || text.trim().length < 8) return;
    _classifyDebounceTimer = Timer(_classifyDebounce, () => _maybeSuggestCategory(text));
  }

  Future<void> _maybeSuggestCategory(String text) async {
    final suggested = await ref.read(reportRepositoryProvider).suggestCategory(text);
    if (!mounted || _categoryManuallySet || suggested == null || !categoryOptions.containsKey(suggested)) return;
    setState(() {
      _category = suggested;
      _categoryJustSuggested = true;
    });
  }

  Future<void> _takePhoto() async {
    final photo = await ref.read(cameraGpsCaptureProvider).captureFromCamera();
    if (photo == null) return;
    final bytes = await photo.readAsBytes();
    setState(() {
      _photoBytes = bytes;
      _photoFilename = photo.name;
      _resolvingLocation = true;
      _error = null;
    });
    final resolved = await ref.read(locationResolverProvider).resolveFromPhoto(bytes);
    if (!mounted) return;
    setState(() {
      _location = resolved;
      _resolvingLocation = false;
    });
  }

  Future<void> _useDeviceLocation() async {
    setState(() => _resolvingLocation = true);
    final resolved = await ref.read(locationResolverProvider).resolveFromDevice();
    if (!mounted) return;
    setState(() {
      _location = resolved;
      _resolvingLocation = false;
      if (resolved == null) {
        _error = 'Không lấy được vị trí — hãy bật định vị và cấp quyền cho ứng dụng.';
      }
    });
  }

  Future<void> _submit() async {
    final location = _location;
    if (location == null) {
      setState(() => _error = 'Cần có vị trí trước khi gửi tin báo.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(reportRepositoryProvider).createReport(
            category: _category,
            description: _descriptionController.text,
            lat: location.lat,
            lng: location.lng,
            locationSource: location.source,
            attachments: _photoBytes != null
                ? [(bytes: _photoBytes!, filename: _photoFilename ?? 'photo.jpg')]
                : const [],
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi tin báo. Cảm ơn bạn!')),
      );
      setState(() {
        _photoBytes = null;
        _photoFilename = null;
        _location = null;
        _descriptionController.clear();
        _category = categoryOptions.keys.first;
        _categoryManuallySet = false;
        _categoryJustSuggested = false;
      });
    } catch (_) {
      setState(() => _error = 'Gửi tin báo thất bại. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Báo tin'),
        actions: [
          IconButton(
            tooltip: 'Hồ sơ',
            icon: const Icon(Icons.person_outline),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _IntroBanner(colors: colors),
          const SizedBox(height: 28),
          const _SectionHeader(icon: Icons.category_outlined, label: 'Loại vụ việc'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: categoryOptions.entries.map((entry) {
              final selected = _category == entry.key;
              return ChoiceChip(
                avatar: Icon(
                  categoryIcon(entry.key),
                  size: 18,
                  color: selected ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                ),
                label: Text(entry.value),
                selected: selected,
                onSelected: (_) => setState(() {
                  _category = entry.key;
                  _categoryManuallySet = true;
                  _categoryJustSuggested = false;
                }),
              );
            }).toList(),
          ),
          if (_categoryJustSuggested) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.auto_awesome, size: 14, color: colors.primary),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Đã gợi ý dựa trên mô tả (AI) — bạn có thể chọn lại loại khác.',
                    style: TextStyle(color: colors.onSurfaceVariant, fontSize: 12),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 28),
          const _SectionHeader(icon: Icons.edit_note, label: 'Mô tả sự việc'),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            maxLines: 4,
            onChanged: _onDescriptionChanged,
            decoration: const InputDecoration(
              hintText: 'Việc gì đã xảy ra, ở đâu, khi nào...',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 28),
          const _SectionHeader(icon: Icons.photo_camera_outlined, label: 'Hình ảnh hiện trường'),
          const SizedBox(height: 12),
          _PhotoPicker(
            colors: colors,
            photoBytes: _photoBytes,
            onTap: _takePhoto,
          ),
          const SizedBox(height: 28),
          const _SectionHeader(icon: Icons.location_on_outlined, label: 'Vị trí'),
          const SizedBox(height: 12),
          _LocationStatus(
            colors: colors,
            resolving: _resolvingLocation,
            location: _location,
            onUseDeviceLocation: _useDeviceLocation,
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: colors.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, size: 18, color: colors.onErrorContainer),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_error!, style: TextStyle(color: colors.onErrorContainer)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 28),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Gửi tin báo'),
          ),
        ],
      ),
    );
  }
}

/// Short welcome/context strip at the top of the form — gives the screen a landing point
/// instead of dropping straight into form controls (product.md: empty states should teach
/// the interface, not read as blank).
class _IntroBanner extends StatelessWidget {
  const _IntroBanner({required this.colors});

  final ColorScheme colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: colors.primary,
            child: Icon(Icons.campaign_outlined, color: colors.onPrimary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Báo tin tới cán bộ phụ trách địa bàn',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: colors.onPrimaryContainer,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Điền thông tin bên dưới — tin sẽ được định tuyến ngay theo vị trí của bạn.',
                  style: TextStyle(color: colors.onPrimaryContainer.withValues(alpha: 0.8), fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(icon, size: 18, color: colors.primary),
        const SizedBox(width: 8),
        Text(
          label,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker({required this.colors, required this.photoBytes, required this.onTap});

  final ColorScheme colors;
  final Uint8List? photoBytes;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (photoBytes != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            Image.memory(photoBytes!, height: 180, width: double.infinity, fit: BoxFit.cover),
            Positioned(
              right: 8,
              bottom: 8,
              child: FilledButton.tonalIcon(
                onPressed: onTap,
                icon: const Icon(Icons.replay, size: 18),
                label: const Text('Chụp lại'),
              ),
            ),
          ],
        ),
      );
    }
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        height: 140,
        width: double.infinity,
        decoration: BoxDecoration(
          color: colors.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.outlineVariant),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_a_photo_outlined, color: colors.onSurfaceVariant, size: 28),
            const SizedBox(height: 8),
            Text('Nhấn để chụp ảnh hiện trường', style: TextStyle(color: colors.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _LocationStatus extends StatelessWidget {
  const _LocationStatus({
    required this.colors,
    required this.resolving,
    required this.location,
    required this.onUseDeviceLocation,
  });

  final ColorScheme colors;
  final bool resolving;
  final ResolvedLocation? location;
  final VoidCallback onUseDeviceLocation;

  @override
  Widget build(BuildContext context) {
    if (resolving) {
      return _statusChip(
        background: colors.surfaceContainerHighest,
        foreground: colors.onSurfaceVariant,
        leading: const SizedBox(
          height: 16,
          width: 16,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        label: 'Đang xác định vị trí...',
      );
    }
    if (location != null) {
      return _statusChip(
        background: colors.tertiaryContainer,
        foreground: colors.onTertiaryContainer,
        leading: Icon(Icons.check_circle, size: 18, color: colors.onTertiaryContainer),
        label: _locationSourceLabel(location!.source),
      );
    }
    return OutlinedButton.icon(
      onPressed: onUseDeviceLocation,
      icon: const Icon(Icons.my_location),
      label: const Text('Dùng vị trí hiện tại của thiết bị'),
    );
  }

  Widget _statusChip({
    required Color background,
    required Color foreground,
    required Widget leading,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          leading,
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: TextStyle(color: foreground))),
        ],
      ),
    );
  }
}

String _locationSourceLabel(String source) {
  switch (source) {
    case 'exif':
      return 'Vị trí lấy từ ảnh (GPS)';
    case 'device_gps':
      return 'Vị trí hiện tại của thiết bị';
    default:
      return 'Vị trí đã chọn thủ công';
  }
}
