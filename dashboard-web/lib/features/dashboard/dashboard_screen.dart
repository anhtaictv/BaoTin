import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../auth/dashboard_login_screen.dart';
import '../reports/reports_providers.dart';
import '../reports/reports_tab.dart';
import '../signals/signals_providers.dart';
import '../signals/signals_tab.dart';
import '../search/search_tab.dart';
import 'dashboard_overview_tab.dart';
import 'dashboard_providers.dart';

/// Shell: NavigationRail (2 destinations) + shared AppBar — ui-ux-pro-max
/// "adaptive-navigation": large screens (≥1024px, the whole point of a control-room
/// dashboard) prefer a sidebar over top tabs.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _tabIndex = 0;

  Future<void> _logout() async {
    await ref.read(dashboardAuthRepositoryProvider).logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const DashboardLoginScreen()),
      (route) => false,
    );
  }

  void _refreshAll() {
    ref.invalidate(districtOptionsProvider);
    ref.invalidate(overviewProvider);
    ref.invalidate(responseTimeByDistrictProvider);
    ref.invalidate(responseTimeByOfficerProvider);
    ref.invalidate(volumeTrendProvider);
    ref.invalidate(cameraQueueProvider);
    ref.invalidate(reportListProvider);
    ref.invalidate(signalListProvider);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Báo Tin — Trung tâm điều hành'),
        actions: [
          IconButton(tooltip: 'Làm mới', icon: const Icon(Icons.refresh), onPressed: _refreshAll),
          IconButton(tooltip: 'Đăng xuất', icon: const Icon(Icons.logout), onPressed: _logout),
          const SizedBox(width: 8),
        ],
      ),
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _tabIndex,
            onDestinationSelected: (i) => setState(() => _tabIndex = i),
            labelType: NavigationRailLabelType.all,
            destinations: const [
              NavigationRailDestination(
                icon: Icon(Icons.dashboard_outlined),
                selectedIcon: Icon(Icons.dashboard),
                label: Text('Tổng quan'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.inbox_outlined),
                selectedIcon: Icon(Icons.inbox),
                label: Text('Tin báo'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.feed_outlined),
                selectedIcon: Icon(Icons.feed),
                label: Text('Tin nhanh'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.travel_explore_outlined),
                selectedIcon: Icon(Icons.travel_explore),
                label: Text('Tìm kiếm'),
              ),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: const [DashboardOverviewTab(), ReportsTab(), SignalsTab(), SearchTab()],
            ),
          ),
        ],
      ),
    );
  }
}
