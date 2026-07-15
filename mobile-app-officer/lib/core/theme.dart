import 'package:flutter/material.dart';

/// Officer app theme: denser, more neutral than the citizen app (ARCHITECTURE.md: this is
/// a working tool for triage/verification, not a public-facing app) — same status color
/// language as mobile-app-citizen so the two apps never disagree on what a status means.
class BaoTinOfficerTheme {
  BaoTinOfficerTheme._();

  static const Color primary = Color(0xFF334155);

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(seedColor: primary, brightness: Brightness.light);
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
      ),
      listTileTheme: const ListTileThemeData(dense: false),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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

Color urgencyColor(String urgency) => urgency == 'emergency' ? const Color(0xFFD32F2F) : Colors.grey.shade600;

String urgencyLabel(String urgency) => urgency == 'emergency' ? 'KHẨN CẤP' : 'Bình thường';
