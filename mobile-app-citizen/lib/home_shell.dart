import 'package:flutter/material.dart';
import 'core/bao_tin_badge.dart';
import 'core/responsive.dart';
import 'core/theme.dart';
import 'features/report/bao_tin_screen.dart';
import 'features/emergency/sos_screen.dart';
import 'features/status/my_reports_screen.dart';
import 'features/area_safety/area_safety_screen.dart';
import 'features/wanted/wanted_notices_screen.dart';
import 'features/news/news_screen.dart';

/// Adaptive shell: bottom nav + SOS dot on a phone-width screen, a left sidebar rail on a
/// desktop-width browser (anh, 2026-07-22: a fixed phone-shaped layout on wide browsers
/// "trông như app mobile" — a sidebar is the standard "this is a real website" pattern,
/// same idea Notion/Linear/Gmail use). SOS is pushed as its own full-screen route either way
/// — it's a one-shot action, not a section you browse.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _screens = [
    BaoTinScreen(),
    MyReportsScreen(),
    AreaSafetyScreen(),
    WantedNoticesScreen(),
    NewsScreen(),
  ];

  static const _destinations = [
    (
      icon: Icons.campaign_outlined,
      activeIcon: Icons.campaign,
      label: 'Báo tin'
    ),
    (icon: Icons.history, activeIcon: Icons.history, label: 'Tin của tôi'),
    (icon: Icons.map_outlined, activeIcon: Icons.map, label: 'Khu vực'),
    (icon: Icons.badge_outlined, activeIcon: Icons.badge, label: 'Truy nã'),
    (icon: Icons.newspaper_outlined, activeIcon: Icons.newspaper, label: 'Tin tức'),
  ];

  void _openSos() {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const SosScreen()));
  }

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
              onSos: _openSos,
            ),
            Expanded(
              child: ColoredBox(
                color: const Color(0xFFF7F5F2),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
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
      // Nested per-tab Scaffolds (e.g. BaoTinScreen's TextField) already resize for the
      // keyboard on their own; letting this outer Scaffold resize too made the Positioned
      // bottom bar jump up/down every time the keyboard opened or closed.
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          Positioned.fill(
            bottom: 64,
            child: IndexedStack(index: _index, children: _screens),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            // SOS shares this Stack with the bar (instead of its own Positioned anchored to
            // the screen bottom) so it rides along with the same SafeArea inset the bar uses
            // — previously it was offset from the raw screen edge, so on any phone with a
            // bottom gesture inset it sat visibly lower than the other nav icons.
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                _BottomBar(
                  destinations: _destinations,
                  selectedIndex: _index,
                  onSelect: (i) => setState(() => _index = i),
                ),
                Positioned(
                  top: 9,
                  left: 0,
                  right: 0,
                  child: Center(child: _SosFab(onTap: _openSos)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SideNav extends StatelessWidget {
  const _SideNav({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
    required this.onSos,
  });

  final List<({IconData icon, IconData activeIcon, String label})> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final VoidCallback onSos;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 248,
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
                  BaoTinBadge(size: 36),
                  SizedBox(width: 10),
                  Text('Báo Tin',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            for (var i = 0; i < destinations.length; i++)
              _SideNavItem(
                  item: destinations[i],
                  selected: selectedIndex == i,
                  onTap: () => onSelect(i)),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: OutlinedButton.icon(
                onPressed: onSos,
                icon: const Icon(Icons.warning_amber_rounded),
                label: const Text('Cấp cứu / SOS'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: BaoTinTheme.primary,
                  side: const BorderSide(color: BaoTinTheme.primary),
                ),
              ),
            ),
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
            ? BaoTinTheme.primary.withValues(alpha: 0.1)
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
                  color: selected ? BaoTinTheme.primary : Colors.grey.shade600,
                ),
                const SizedBox(width: 14),
                Text(
                  item.label,
                  style: TextStyle(
                    color:
                        selected ? BaoTinTheme.primary : Colors.grey.shade800,
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

class _BottomBar extends StatelessWidget {
  const _BottomBar(
      {required this.destinations,
      required this.selectedIndex,
      required this.onSelect});

  final List<({IconData icon, IconData activeIcon, String label})> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        height: 64,
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, -2)),
          ],
        ),
        child: Row(
          children: [
            for (var i = 0; i < destinations.length; i++)
              if (i == destinations.length ~/ 2) ...[
                const SizedBox(width: 46), // gap the SOS dot sits in
                _NavItem(
                    item: destinations[i],
                    selected: selectedIndex == i,
                    onTap: () => onSelect(i)),
              ] else
                _NavItem(
                    item: destinations[i],
                    selected: selectedIndex == i,
                    onTap: () => onSelect(i)),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem(
      {required this.item, required this.selected, required this.onTap});

  final ({IconData icon, IconData activeIcon, String label}) item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? BaoTinTheme.primary : Colors.grey.shade500;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(selected ? item.activeIcon : item.icon,
                color: color, size: 24),
            const SizedBox(height: 4),
            Text(
              item.label,
              style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }
}

class _SosFab extends StatelessWidget {
  const _SosFab({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 46,
        height: 46,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: BaoTinTheme.primary,
          boxShadow: [
            BoxShadow(
                color: Color(0x40C62828), blurRadius: 8, offset: Offset(0, 3)),
          ],
        ),
        child: const Icon(Icons.warning_amber_rounded,
            color: Colors.white, size: 24),
      ),
    );
  }
}
