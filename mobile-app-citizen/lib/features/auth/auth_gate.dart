import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../home_shell.dart';
import 'citizen_login_screen.dart';

/// App entry point: silently checks for a stored access token and skips straight to the
/// main app if present — otherwise starts the username/password login flow (with a link to
/// the older OTP-only quick-report flow, see citizen_login_screen.dart).
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<bool>(
      future: ref.read(authRepositoryProvider).isLoggedIn(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.data == true ? const HomeShell() : const CitizenLoginScreen();
      },
    );
  }
}
