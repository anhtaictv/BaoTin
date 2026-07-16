import 'package:flutter/material.dart';
import 'core/navigation.dart';
import 'core/theme.dart';
import 'features/auth/dashboard_auth_gate.dart';

class BaoTinDashboardApp extends StatelessWidget {
  const BaoTinDashboardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: dashboardNavigatorKey,
      title: 'Báo Tin — Trung tâm điều hành',
      debugShowCheckedModeBanner: false,
      theme: DashboardTheme.light(),
      darkTheme: DashboardTheme.dark(),
      home: const DashboardAuthGate(),
    );
  }
}
