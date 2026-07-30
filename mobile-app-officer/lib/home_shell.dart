import 'package:flutter/material.dart';
import 'core/bao_tin_badge.dart';
import 'core/responsive.dart';
import 'core/theme.dart';
import 'features/locations/report_map_screen.dart';
import 'features/overview/overview_screen.dart';
import 'features/reports_list/report_list_screen.dart';
import 'features/wanted/wanted_notices_screen.dart';
import 'features/admin_menu/admin_menu_screen.dart';
import 'features/traffic_accidents/traffic_accident_list_screen.dart';
import 'features/news/news_screen.dart';
import 'features/chat/chat_channel_list_screen.dart';

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
    TrafficAccidentListScreen(),
    ChatChannelListScreen(),
    AdminMenuScreen(),
    NewsScreen(),
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
      icon: Icons.car_crash_outlined,
      activeIcon: Icons.car_crash,
      label: 'Cảnh báo TNGT'
    ),
    (icon: Icons.forum_outlined, activeIcon: Icons.forum, label: 'Chat'),
    (
      icon: Icons.admin_panel_settings_outlined,
      activeIcon: Icons.admin_panel_settings,
      label: 'Quản trị'
    ),
    (
      icon: Icons.newspaper_outlined,
      activeIcon: Icons.newspaper,
      label: 'Tin tức'
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
      bottomNavigationBar: _AnimatedNavBar(
        destinations: _destinations,
        selectedIndex: _index,
        onSelect: (i) => setState(() => _index = i),
      ),
    );
  }
}

/// 9 tabs is too many to caption all at once on a phone-width bar — icon-only by default,
/// evenly split; tapping a tab grows its slot to fit the label (sliding it out) and the rest
/// shrink evenly to make room, instead of Material's stock NavigationBar which just fades a
/// label in/out in place.
class _AnimatedNavBar extends StatelessWidget {
  const _AnimatedNavBar({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
  });

  final List<({IconData icon, IconData activeIcon, String label})> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  static const _selectedWidth = 124.0;
  static const _slideDuration = Duration(milliseconds: 260);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        height: 60,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, -2)),
          ],
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final restWidth =
                (constraints.maxWidth - _selectedWidth) / (destinations.length - 1);
            return Row(
              children: [
                for (var i = 0; i < destinations.length; i++)
                  AnimatedContainer(
                    duration: _slideDuration,
                    curve: Curves.easeOutCubic,
                    width: i == selectedIndex ? _selectedWidth : restWidth,
                    alignment: Alignment.center,
                    clipBehavior: Clip.hardEdge,
                    decoration: const BoxDecoration(),
                    child: _AnimatedNavItem(
                      item: destinations[i],
                      selected: i == selectedIndex,
                      onTap: () => onSelect(i),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AnimatedNavItem extends StatelessWidget {
  const _AnimatedNavItem(
      {required this.item, required this.selected, required this.onTap});

  final ({IconData icon, IconData activeIcon, String label}) item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? BaoTinOfficerTheme.primary : Colors.grey.shade500;
    return InkWell(
      onTap: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(selected ? item.activeIcon : item.icon, color: color, size: 22),
          if (selected) ...[
            const SizedBox(width: 6),
            Flexible(
              child: AnimatedOpacity(
                opacity: selected ? 1 : 0,
                duration: const Duration(milliseconds: 200),
                child: Text(
                  item.label,
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
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
        color: Theme.of(context).colorScheme.surface,
        border: Border(right: BorderSide(color: Theme.of(context).dividerColor)),
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
