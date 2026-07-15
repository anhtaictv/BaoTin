import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../dashboard/dashboard_screen.dart';
import 'dashboard_login_screen.dart';

class DashboardAuthGate extends ConsumerWidget {
  const DashboardAuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<bool>(
      future: ref.read(dashboardAuthRepositoryProvider).isLoggedIn(),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.data == true ? const DashboardScreen() : const DashboardLoginScreen();
      },
    );
  }
}
