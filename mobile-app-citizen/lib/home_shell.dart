import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/report/bao_tin_screen.dart';
import 'features/emergency/sos_screen.dart';
import 'features/status/my_reports_screen.dart';
import 'features/area_safety/area_safety_screen.dart';

/// Bottom-nav shell for the 3 Giai đoạn 1 citizen screens. SOS is visually distinct
/// (red icon) even in the nav bar — CLAUDE.md: SOS must never blend in with routine UI.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _screens = [
    BaoTinScreen(),
    SosScreen(),
    MyReportsScreen(),
    AreaSafetyScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.campaign_outlined), label: 'Báo tin'),
          NavigationDestination(
            icon: Icon(Icons.sos, color: BaoTinTheme.emergency),
            label: 'Cấp cứu',
          ),
          NavigationDestination(icon: Icon(Icons.history), label: 'Tin của tôi'),
          NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Khu vực'),
        ],
      ),
    );
  }
}
