import 'package:flutter/material.dart';
import 'features/locations/report_map_screen.dart';
import 'features/overview/overview_screen.dart';
import 'features/reports_list/report_list_screen.dart';

/// Bottom-nav shell tying the officer app's 4 top-level views together — mirrors
/// mobile-app-citizen's home_shell.dart. "Tin nhanh (tham khảo)" deliberately stays out of
/// this shell (reached only via the icon on Tin báo's AppBar): CLAUDE.md non-negotiable
/// #1/#2 requires MXH signals to read as completely separate from citizen reports, and giving
/// it an equal-weight bottom-nav slot next to verified reports risks exactly that blur.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _screens = [
    OverviewScreen(),
    ReportListScreen(),
    ReportMapScreen(),
    ReportListScreen(historyMode: true),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Tổng quan'),
          NavigationDestination(icon: Icon(Icons.assignment_outlined), label: 'Tin báo'),
          NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Địa điểm'),
          NavigationDestination(icon: Icon(Icons.history), label: 'Lịch sử'),
        ],
      ),
    );
  }
}
