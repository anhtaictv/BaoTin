import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../home_shell.dart';
import 'otp_request_screen.dart';

/// App entry point: silently checks for a stored access token and skips straight to the
/// main app if present — otherwise starts the OTP login flow.
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
        return snapshot.data == true ? const HomeShell() : const OtpRequestScreen();
      },
    );
  }
}
