import 'package:flutter/material.dart';

/// Báo Tin citizen app theme — red/green, matching the visual language of official Vietnamese
/// police "SOS An ninh trật tự" apps (anh's explicit request, 2026-07-22: "làm giao diện giống
/// người ta" after showing screenshots of CATP HCM's SOS app). Red now carries the whole brand
/// (buttons, links, active states) rather than being reserved only for the emergency action —
/// same as the reference app. SOS still reads as unmistakably distinct, just via a floating
/// circular button that breaks out of the bottom nav bar (see home_shell.dart) instead of via
/// a color no other element is allowed to use.
class BaoTinTheme {
  BaoTinTheme._();

  static const Color primary = Color(0xFFC62828);
  static const Color primaryDark = Color(0xFF8E1C1C);
  static const Color heroGreenDark = Color(0xFF1B4D22);
  static const Color heroGreenLight = Color(0xFF2E7D32);
  static const Color heroCream = Color(0xFFFFFBEA);
  static const Color gold = Color(0xFFE3C169);

  /// Alias kept for call sites that still name it "emergency" — same red as `primary` now,
  /// SOS's distinctiveness comes from shape/position, not a reserved hue.
  static const Color emergency = primary;

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFFF7F5F2),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF1A1A1A),
        elevation: 0,
        centerTitle: true,
        surfaceTintColor: Colors.transparent,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(54),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          shape: const StadiumBorder(),
          side: const BorderSide(color: primary),
          foregroundColor: primary,
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: primary),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.grey.shade200),
        ),
        color: Colors.white,
      ),
      chipTheme: ChipThemeData(
        shape: StadiumBorder(side: BorderSide(color: colorScheme.outlineVariant)),
        selectedColor: colorScheme.primaryContainer,
        backgroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primary, width: 1.5),
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
      return BaoTinTheme.primary;
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
