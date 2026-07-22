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
      // App is designed mobile-first; on a wide desktop browser (Flutter Web), letterbox it to
      // a phone-like width instead of stretching every screen edge-to-edge. No effect on an
      // actual phone — the incoming constraint there is already narrower than maxWidth.
      builder: (context, child) => ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: child,
          ),
        ),
      ),
    );
  }
}
