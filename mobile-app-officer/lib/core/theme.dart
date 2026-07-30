import 'package:flutter/material.dart';

/// Officer app theme: denser, more professional navy than the citizen app's public-facing
/// red/green (ARCHITECTURE.md: this is a working tool for triage/verification, not a
/// public-facing app) — same status color language as mobile-app-citizen so the two apps
/// never disagree on what a status means. Redesigned 2026-07-22 alongside the citizen app's
/// reskin (anh: "sửa lại app trên web cho đẹp luôn, cả officer và citizen luôn") — same shape
/// language (pill buttons, rounded cards) and the same red/gold Báo Tin badge for brand
/// continuity between the two apps, but its own navy identity rather than citizen red.
class BaoTinOfficerTheme {
  BaoTinOfficerTheme._();

  static const Color primary = Color(0xFF1E3A5F);
  static const Color primaryDark = Color(0xFF12253D);
  static const Color primaryLight = Color(0xFF2D5480);
  static const Color gold = Color(0xFFE3C169);

  /// Dark variant tokens — same navy family as the light theme, just darker background/
  /// surface steps rather than an automatic light-mode inversion. primaryLight (already used
  /// for hover/light accents) becomes the interactive accent against the dark background
  /// since the base `primary` navy is too close to backgroundDark for enough contrast.
  static const Color backgroundDark = Color(0xFF0F1720);
  static const Color surfaceDark = Color(0xFF1A2432);
  static const Color borderDark = Color(0xFF2E3B4E);

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(seedColor: primary, brightness: Brightness.light);
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFFF5F6F8),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF1A1A1A),
        elevation: 0,
        centerTitle: true,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: primary.withValues(alpha: 0.12),
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? primary : Colors.grey.shade600,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? primary : Colors.grey.shade600),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: const StadiumBorder(),
          side: const BorderSide(color: primary),
          foregroundColor: primary,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: primary)),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.grey.shade200),
        ),
        color: Colors.white,
      ),
      listTileTheme: const ListTileThemeData(dense: false),
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

  static ThemeData dark() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primaryLight,
      brightness: Brightness.dark,
      surface: surfaceDark,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: backgroundDark,
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surfaceDark,
        indicatorColor: primaryLight.withValues(alpha: 0.24),
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? primaryLight : Colors.grey.shade400,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? primaryLight : Colors.grey.shade400),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primaryLight,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: const StadiumBorder(),
          side: const BorderSide(color: primaryLight),
          foregroundColor: primaryLight,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: primaryLight)),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: borderDark),
        ),
        color: surfaceDark,
      ),
      listTileTheme: const ListTileThemeData(dense: false),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceDark,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: borderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: borderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primaryLight, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}

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
      return BaoTinOfficerTheme.primary;
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

Color urgencyColor(String urgency) => urgency == 'emergency' ? const Color(0xFFD32F2F) : Colors.grey.shade600;

String urgencyLabel(String urgency) => urgency == 'emergency' ? 'KHẨN CẤP' : 'Bình thường';

const _categoryLabels = <String, String>{
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

/// Reports/signals store the raw category code (`trom_cap`, ...) — same vocabulary as
/// mobile-app-citizen. Falls back to the raw value itself for any code not in the map yet,
/// rather than silently showing "Khác", so a backend addition is visible instead of hidden.
String categoryLabel(String? category) => _categoryLabels[category] ?? category ?? 'Khác';

IconData categoryIcon(String? category) => _categoryIcons[category] ?? Icons.report_outlined;

/// CLAUDE.md nguyên tắc #1: tín hiệu MXH/báo chí không bao giờ được gắn nhãn giống tin đã
/// xác thực — dùng bảng màu hoàn toàn khác statusColor/urgencyColor (tím/xám thay vì
/// xanh/đỏ) để không ai nhầm lẫn hai loại dữ liệu khi lướt nhanh qua UI.
Color trustLevelColor(String trustLevel) =>
    trustLevel == 'verified_press' ? const Color(0xFF6A1B9A) : Colors.blueGrey.shade400;

String trustLevelLabel(String trustLevel) =>
    trustLevel == 'verified_press' ? 'Báo chí' : 'MXH — chưa xác thực';

/// Giai đoạn 4 "độ nóng tin MXH" — mật độ tín hiệu theo địa bàn, khác khái niệm với
/// statusColor/trustLevelColor nên dùng bảng màu riêng.
Color heatLevelColor(String level) {
  switch (level) {
    case 'high':
      return const Color(0xFFD32F2F);
    case 'medium':
      return const Color(0xFFF9A825);
    case 'low':
    default:
      return Colors.grey.shade500;
  }
}

String heatLevelLabel(String level) {
  switch (level) {
    case 'high':
      return 'Nóng';
    case 'medium':
      return 'Đang tăng';
    case 'low':
    default:
      return 'Bình thường';
  }
}
