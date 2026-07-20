import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../../home_shell.dart';
import 'officer_login_screen.dart';

class OfficerAuthGate extends ConsumerWidget {
  const OfficerAuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<bool>(
      future: ref.read(officerAuthRepositoryProvider).isLoggedIn(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.data == true ? const HomeShell() : const OfficerLoginScreen();
      },
    );
  }
}
