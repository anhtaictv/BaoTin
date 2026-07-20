import 'package:flutter/material.dart';

/// Báo Tin citizen app theme: calm blue for everyday reporting, a single unmistakable
/// red reserved only for the SOS/emergency action so it never competes visually with
/// normal UI chrome (per ARCHITECTURE.md: SOS must read as obviously different/urgent).
class BaoTinTheme {
  BaoTinTheme._();

  static const Color primary = Color(0xFF1B5FA8);
  static const Color emergency = Color(0xFFD32F2F);

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      // Tonal elevation (M3): scaffold sits one tone below card surfaces instead of a
      // hand-picked hex, so the background stays tied to the seed color in dark mode too.
      scaffoldBackgroundColor: colorScheme.surfaceContainerLow,
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surfaceContainerLow,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: colorScheme.surface,
      ),
      chipTheme: ChipThemeData(
        shape: StadiumBorder(side: BorderSide(color: colorScheme.outlineVariant)),
        selectedColor: colorScheme.primaryContainer,
        backgroundColor: colorScheme.surface,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}

/// Status badge colors — kept consistent everywhere a report's status is shown, so an
/// officer/citizen learns the color language once (CLAUDE.md: no ambiguity between states).
Color statusColor(String status) {
  switch (status) {
    case 'confirmed_true':
      return const Color(0xFF2E7D32);
    case 'confirmed_false':
      return const Color(0xFF757575);
    case 'verifying':
      return const Color(0xFFF9A825);
    case 'pending':
    default:
      return const Color(0xFF1B5FA8);
  }
}

/// Bản đồ cảnh báo khu vực (Giai đoạn 3) — mật độ tin báo theo xã/phường, không phải
/// trạng thái xác minh, nên dùng bảng màu riêng thay vì statusColor.
Color alertLevelColor(String level) {
  switch (level) {
    case 'high':
      return const Color(0xFFD32F2F);
    case 'medium':
      return const Color(0xFFF9A825);
    case 'low':
    default:
      return const Color(0xFF2E7D32);
  }
}

String statusLabel(String status) {
  switch (status) {
    case 'confirmed_true':
      return 'Đúng sự thật';
    case 'confirmed_false':
      return 'Tin sai';
    case 'verifying':
      return 'Đang xác minh';
    case 'pending':
    default:
      return 'Chờ xử lý';
  }
}

/// Ordered so the "Loại vụ việc" chip selector in bao_tin_screen.dart has a stable layout —
/// shared here (not private to that file) so any other screen showing a report's category
/// (my_reports_screen.dart, report_status_screen.dart) uses the same Vietnamese labels
/// instead of falling back to the raw backend code like "trom_cap".
const categoryOptions = <String, String>{
  'trom_cap': 'Trộm cắp',
  'tai_nan': 'Tai nạn',
  'chay_no': 'Cháy nổ',
  'an_ninh_khan_cap': 'An ninh khẩn cấp',
  'khac': 'Khác',
};

const _categoryIcons = <String, IconData>{
  'trom_cap': Icons.inventory_2_outlined,
  'tai_nan': Icons.car_crash_outlined,
  'chay_no': Icons.local_fire_department_outlined,
  'an_ninh_khan_cap': Icons.emergency_outlined,
  'khac': Icons.more_horiz_outlined,
};

/// Falls back to the raw code itself for anything not in the map yet, rather than silently
/// showing "Khác" — a backend addition stays visible instead of hidden (same convention as
/// mobile-app-officer's core/theme.dart categoryLabel).
String categoryLabel(String? category) => categoryOptions[category] ?? category ?? 'Khác';

IconData categoryIcon(String? category) => _categoryIcons[category] ?? Icons.report_outlined;
