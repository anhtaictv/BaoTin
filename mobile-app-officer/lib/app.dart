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
      darkTheme: BaoTinOfficerTheme.dark(),
      themeMode: ThemeMode.system,
      home: const OfficerAuthGate(),
      // Individual screens (home_shell.dart, officer_password_login_screen.dart, ...) adapt
      // their own layout at kWideBreakpoint (side nav, split hero+form) — this only stops
      // content from stretching absurdly wide on an ultrawide monitor, it does not letterbox
      // to a phone width (that read as "a mobile app in a box" on a normal desktop browser).
      builder: (context, child) => ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1600),
            child: child,
          ),
        ),
      ),
    );
  }
}
