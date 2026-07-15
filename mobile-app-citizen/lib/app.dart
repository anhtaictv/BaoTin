import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/auth/auth_gate.dart';

class BaoTinCitizenApp extends StatelessWidget {
  const BaoTinCitizenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Báo Tin',
      debugShowCheckedModeBanner: false,
      theme: BaoTinTheme.light(),
      home: const AuthGate(),
    );
  }
}
