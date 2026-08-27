import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/accessibility_settings.dart';
import 'core/api_client.dart';
import 'core/theme.dart';
import 'features/auth/auth_gate.dart';
import 'features/auth/citizen_login_screen.dart';

/// Lets code outside the widget tree (ApiClient, on a failed token refresh) redirect to login
/// even when the user is several screens deep — rebuilding AuthGate alone wouldn't be visible
/// once other routes are pushed on top of it.
final navigatorKey = GlobalKey<NavigatorState>();

class BaoTinCitizenApp extends ConsumerStatefulWidget {
  const BaoTinCitizenApp({super.key});

  @override
  ConsumerState<BaoTinCitizenApp> createState() => _BaoTinCitizenAppState();
}

class _BaoTinCitizenAppState extends ConsumerState<BaoTinCitizenApp> {
  @override
  void initState() {
    super.initState();
    sessionExpiredTick.addListener(_onSessionExpired);
  }

  @override
  void dispose() {
    sessionExpiredTick.removeListener(_onSessionExpired);
    super.dispose();
  }

  void _onSessionExpired() {
    navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const CitizenLoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Báo Tin',
      debugShowCheckedModeBanner: false,
      theme: BaoTinTheme.light(),
      darkTheme: BaoTinTheme.dark(),
      themeMode: ThemeMode.system,
      home: const AuthGate(),
      // Individual screens (home_shell.dart, citizen_login_screen.dart, ...) adapt their own
      // layout at kWideBreakpoint (side nav rail, split hero+form) — this only stops content
      // from stretching absurdly wide on an ultrawide monitor, it does not letterbox to a
      // phone width (that read as "a mobile app in a box" on a normal desktop browser).
      builder: (context, child) {
        final largeText = ref.watch(largeTextProvider);
        return ColoredBox(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1600),
              child: MediaQuery(
                data: MediaQuery.of(context).copyWith(
                  textScaler: largeText ? const TextScaler.linear(largeTextScale) : MediaQuery.of(context).textScaler,
                ),
                child: child!,
              ),
            ),
          ),
        );
      },
    );
  }
}
