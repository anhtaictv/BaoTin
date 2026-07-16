import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../profile/profile_screen.dart';
import 'camera_gps_capture.dart';

/// How long to wait after the last keystroke before asking for a category suggestion — avoids
/// firing a request per character while the person is still typing.
const _classifyDebounce = Duration(milliseconds: 800);

const _categories = <String, String>{
  'trom_cap': 'Trộm cắp',
  'tai_nan': 'Tai nạn',
  'chay_no': 'Cháy nổ',
  'an_ninh_khan_cap': 'An ninh khẩn cấp',
  'khac': 'Khác',
};

class BaoTinScreen extends ConsumerStatefulWidget {
  const BaoTinScreen({super.key});

  @override
  ConsumerState<BaoTinScreen> createState() => _BaoTinScreenState();
}

class _BaoTinScreenState extends ConsumerState<BaoTinScreen> {
  final _descriptionController = TextEditingController();
  String _category = _categories.keys.first;
  String? _photoPath;
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
    if (!mounted || _categoryManuallySet || suggested == null || !_categories.containsKey(suggested)) return;
    setState(() {
      _category = suggested;
      _categoryJustSuggested = true;
    });
  }

  Future<void> _takePhoto() async {
    final photo = await ref.read(cameraGpsCaptureProvider).captureFromCamera();
    if (photo == null) return;
    setState(() {
      _photoPath = photo.path;
      _resolvingLocation = true;
      _error = null;
    });
    final resolved = await ref.read(locationResolverProvider).resolveFromPhoto(photo.path);
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
            attachmentPaths: _photoPath != null ? [_photoPath!] : const [],
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi tin báo. Cảm ơn bạn!')),
      );
      setState(() {
        _photoPath = null;
        _location = null;
        _descriptionController.clear();
        _category = _categories.keys.first;
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
        padding: const EdgeInsets.all(16),
        children: [
          Text('Loại vụ việc', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _categories.entries.map((entry) {
              final selected = _category == entry.key;
              return ChoiceChip(
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
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.auto_awesome, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Đã gợi ý dựa trên mô tả (AI) — bạn có thể chọn lại loại khác.',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          TextField(
            controller: _descriptionController,
            maxLines: 4,
            onChanged: _onDescriptionChanged,
            decoration: const InputDecoration(
              labelText: 'Mô tả sự việc',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hình ảnh & vị trí', style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 12),
                  if (_photoPath != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(File(_photoPath!), height: 160, fit: BoxFit.cover),
                    ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _takePhoto,
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: Text(_photoPath == null ? 'Chụp ảnh hiện trường' : 'Chụp lại'),
                  ),
                  const SizedBox(height: 8),
                  if (_resolvingLocation)
                    const Row(
                      children: [
                        SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                        SizedBox(width: 8),
                        Text('Đang xác định vị trí...'),
                      ],
                    )
                  else if (_location != null)
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: Colors.green, size: 18),
                        const SizedBox(width: 4),
                        Text(_locationSourceLabel(_location!.source)),
                      ],
                    )
                  else
                    TextButton.icon(
                      onPressed: _useDeviceLocation,
                      icon: const Icon(Icons.my_location),
                      label: const Text('Dùng vị trí hiện tại của thiết bị'),
                    ),
                ],
              ),
            ),
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
                : const Text('Gửi tin báo'),
          ),
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
