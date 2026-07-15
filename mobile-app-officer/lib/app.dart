import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/auth/officer_auth_gate.dart';

class BaoTinOfficerApp extends StatelessWidget {
  const BaoTinOfficerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Báo Tin — Cán bộ',
      debugShowCheckedModeBanner: false,
      theme: BaoTinOfficerTheme.light(),
      home: const OfficerAuthGate(),
    );
  }
}
