import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// "Chế độ chữ to, dễ đọc" — cho người lớn tuổi/nông thôn ít dùng smartphone. Chỉ phóng to
/// text scale (MediaQuery.textScaler ở app.dart) thay vì tự vẽ lại toàn bộ UI — đủ đáp ứng nhu
/// cầu đọc rõ mà không phải làm lại từng màn hình.
const _kLargeTextPrefKey = 'large_text_enabled';
const largeTextScale = 1.3;

class LargeTextNotifier extends StateNotifier<bool> {
  LargeTextNotifier() : super(false) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getBool(_kLargeTextPrefKey) ?? false;
  }

  Future<void> toggle(bool enabled) async {
    state = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kLargeTextPrefKey, enabled);
  }
}

final largeTextProvider = StateNotifierProvider<LargeTextNotifier, bool>((ref) => LargeTextNotifier());
