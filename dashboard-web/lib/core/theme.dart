import 'package:flutter/material.dart';

/// Design system generated via the installed `ui-ux-pro-max` skill for an internal
/// ops/analytics dashboard:
///   - `--design-system "admin dashboard analytics saas internal tool" --density 8
///     --variance 2 --motion 2` → colors + typography below
///   - `--domain style "dense dashboard data table admin professional"` → "Data-Dense
///     Dashboard" pattern: 12-col grid, 8-12px spacing, compact 12-14px type, minimal
///     padding, sticky headers, maximum information density
/// Deliberately distinct from mobile-app-citizen/mobile-app-officer's themes — this is a
/// working tool for a control-room screen, not a phone UI, so it reads dense and neutral
/// rather than spacious and friendly.
class DashboardTheme {
  DashboardTheme._();

  static const Color primary = Color(0xFF1E40AF);
  static const Color secondary = Color(0xFF3B82F6);
  static const Color accent = Color(0xFFD97706);
  static const Color backgroundLight = Color(0xFFF8FAFC);
  static const Color foregroundLight = Color(0xFF1E3A8A);
  static const Color borderLight = Color(0xFFDBEAFE);
  static const Color destructiveLight = Color(0xFFDC2626);

  static const Color backgroundDark = Color(0xFF0B1220);
  static const Color surfaceDark = Color(0xFF111A2E);
  static const Color borderDark = Color(0xFF24314F);
  static const Color destructiveDark = Color(0xFFEF4444);

  /// Data-Dense Dashboard spacing tokens (styles.csv: --grid-gap / --card-padding).
  static const double gridGap = 8;
  static const double cardPadding = 12;

  /// Tabular (fixed-width) figures for KPI numbers — ui-ux-pro-max "number-tabular" rule
  /// (prevents column jitter as values update). This is the correct typographic mechanism
  /// (a font feature, supported by the platform default font) rather than depending on a
  /// specific downloaded font: an earlier version of this theme used `google_fonts`
  /// (Fira Sans/Fira Code), but that package fetches .ttf files over HTTP from
  /// fonts.gstatic.com at runtime unless every weight is pre-bundled as a local asset —
  /// a needless external-CDN dependency for an internal ops tool, and one that throws
  /// outright (not a silent fallback) when disabled without bundled assets. Dropped in
  /// favor of the platform default font + tabularFigures, which needs neither network nor
  /// bundled font files.
  static const _tabularFigures = TextStyle(fontFeatures: [FontFeature.tabularFigures()]);

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(seedColor: primary, error: destructiveLight);
    final textTheme = ThemeData.light().textTheme.copyWith(
      displaySmall: _tabularFigures.copyWith(fontSize: 30, fontWeight: FontWeight.w600, color: foregroundLight),
      titleMedium: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: foregroundLight),
      bodySmall: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: backgroundLight,
      textTheme: textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: foregroundLight,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: borderLight),
        ),
      ),
      dividerTheme: const DividerThemeData(color: borderLight, space: 1),
    );
  }

  /// Its own steps against the dark surface — not an automatic light-mode inversion
  /// (dataviz skill §6).
  static ThemeData dark() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: secondary,
      brightness: Brightness.dark,
      surface: surfaceDark,
      error: destructiveDark,
    );
    final textTheme = ThemeData.dark().textTheme.copyWith(
      displaySmall: _tabularFigures.copyWith(fontSize: 30, fontWeight: FontWeight.w600, color: Colors.white),
      titleMedium: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
      bodySmall: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: backgroundDark,
      textTheme: textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surfaceDark,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: borderDark),
        ),
      ),
      dividerTheme: const DividerThemeData(color: borderDark, space: 1),
    );
  }
}

/// Reuses the exact status color/label mapping from mobile-app-officer/lib/core/theme.dart
/// (statusColor/statusLabel) — kept as a literal copy (Flutter packages can't share code
/// across independent pubspec roots without a shared package, which is out of scope for
/// this size of project) so all 3 clients agree on what each status means visually.
/// [isAssigned] only matters for 'pending' — distinguishes "Mới gửi" (chưa gán cán bộ) from
/// "Đã định tuyến" (đã gán) without needing a new backend enum value. Defaults to false so
/// every existing call site keeps its current 4-color behavior unchanged.
Color statusColor(String status, {bool isAssigned = false}) {
  switch (status) {
    case 'confirmed_true':
      return const Color(0xFF2E7D32);
    case 'confirmed_false':
      return const Color(0xFF757575);
    case 'verifying':
      return const Color(0xFFF9A825);
    case 'pending':
    default:
      return isAssigned ? DashboardTheme.secondary : DashboardTheme.primary;
  }
}

String statusLabel(String status, {bool isAssigned = false}) {
  switch (status) {
    case 'confirmed_true':
      return 'Đã xử lý';
    case 'confirmed_false':
      return 'Tin giả/Hủy';
    case 'verifying':
      return 'Đang xác minh';
    case 'pending':
    default:
      return isAssigned ? 'Đã định tuyến' : 'Mới gửi';
  }
}

Color urgencyColor(String urgency) => urgency == 'emergency' ? const Color(0xFFD32F2F) : const Color(0xFF64748B);

String urgencyLabel(String urgency) => urgency == 'emergency' ? 'KHẨN CẤP' : 'Bình thường';

/// CLAUDE.md nguyên tắc #1: tín hiệu MXH/báo chí không bao giờ được gắn nhãn giống tin đã
/// xác thực — bảng màu hoàn toàn khác statusColor/urgencyColor (tím/xám) để không ai nhầm
/// lẫn hai loại dữ liệu khi lướt nhanh qua dashboard.
Color trustLevelColor(String trustLevel) =>
    trustLevel == 'verified_press' ? const Color(0xFF6A1B9A) : const Color(0xFF64748B);

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
      return const Color(0xFF94A3B8);
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

String extractionStatusLabel(String status) {
  switch (status) {
    case 'sent':
      return 'Đã gửi';
    case 'fulfilled':
      return 'Đã xử lý';
    case 'rejected':
      return 'Từ chối';
    case 'pending':
    default:
      return 'Đang chờ';
  }
}
