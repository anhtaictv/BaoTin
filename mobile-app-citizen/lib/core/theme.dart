import 'package:flutter/material.dart';

/// Báo Tin citizen app theme: calm blue for everyday reporting, a single unmistakable
/// red reserved only for the SOS/emergency action so it never competes visually with
/// normal UI chrome (per ARCHITECTURE.md: SOS must read as obviously different/urgent).
class BaoTinTheme {
  BaoTinTheme._();

  static const Color primary = Color(0xFF1B5FA8);
  static const Color emergency = Color(0xFFD32F2F);
  static const Color surfaceMuted = Color(0xFFF4F6F9);

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: surfaceMuted,
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surface,
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
