import 'package:flutter/material.dart';
import 'core/bao_tin_badge.dart';
import 'core/responsive.dart';
import 'core/theme.dart';
import 'features/locations/report_map_screen.dart';
import 'features/overview/overview_screen.dart';
import 'features/reports_list/report_list_screen.dart';
import 'features/wanted/wanted_notices_screen.dart';
import 'features/auth/pending_officers_screen.dart';

/// Adaptive shell: bottom nav on a phone-width screen, a left sidebar on a desktop-width
/// browser (same pattern/breakpoint as mobile-app-citizen's home_shell.dart — anh, 2026-07-22:
/// a real website layout, not a phone screen stretched/boxed into a wide window).
/// "Tin nhanh (tham khảo)" deliberately stays out of this shell (reached only via the icon on
/// Tin báo's AppBar): CLAUDE.md non-negotiable #1/#2 requires MXH signals to read as
/// completely separate from citizen reports, and giving it an equal-weight nav slot next to
/// verified reports risks exactly that blur.
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
    WantedNoticesScreen(),
    PendingOfficersScreen(),
  ];

  static const _destinations = [
    (
      icon: Icons.dashboard_outlined,
      activeIcon: Icons.dashboard,
      label: 'Tổng quan'
    ),
    (
      icon: Icons.assignment_outlined,
      activeIcon: Icons.assignment,
      label: 'Tin báo'
    ),
    (icon: Icons.map_outlined, activeIcon: Icons.map, label: 'Địa điểm'),
    (icon: Icons.history, activeIcon: Icons.history, label: 'Lịch sử'),
    (icon: Icons.badge_outlined, activeIcon: Icons.badge, label: 'Truy nã'),
    (
      icon: Icons.how_to_reg_outlined,
      activeIcon: Icons.how_to_reg,
      label: 'Duyệt TK'
    ),
  ];

  @override
  Widget build(BuildContext context) {
    if (isWideScreen(context)) {
      return Scaffold(
        body: Row(
          children: [
            _SideNav(
              destinations: _destinations,
              selectedIndex: _index,
              onSelect: (i) => setState(() => _index = i),
            ),
            Expanded(
              child: ColoredBox(
                color: const Color(0xFFF5F6F8),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 900),
                    child: IndexedStack(index: _index, children: _screens),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: [
          for (final d in _destinations)
            NavigationDestination(icon: Icon(d.icon), label: d.label),
        ],
      ),
    );
  }
}

class _SideNav extends StatelessWidget {
  const _SideNav(
      {required this.destinations,
      required this.selectedIndex,
      required this.onSelect});

  final List<({IconData icon, IconData activeIcon, String label})> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 240,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: Colors.grey.shade200)),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 24, 20, 8),
              child: Row(
                children: [
                  BaoTinBadge(size: 34),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Báo Tin — Cán bộ',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            for (var i = 0; i < destinations.length; i++)
              _SideNavItem(
                  item: destinations[i],
                  selected: selectedIndex == i,
                  onTap: () => onSelect(i)),
          ],
        ),
      ),
    );
  }
}

class _SideNavItem extends StatelessWidget {
  const _SideNavItem(
      {required this.item, required this.selected, required this.onTap});

  final ({IconData icon, IconData activeIcon, String label}) item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      child: Material(
        color: selected
            ? BaoTinOfficerTheme.primary.withValues(alpha: 0.1)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Icon(
                  selected ? item.activeIcon : item.icon,
                  size: 22,
                  color: selected
                      ? BaoTinOfficerTheme.primary
                      : Colors.grey.shade600,
                ),
                const SizedBox(width: 14),
                Text(
                  item.label,
                  style: TextStyle(
                    color: selected
                        ? BaoTinOfficerTheme.primary
                        : Colors.grey.shade800,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
