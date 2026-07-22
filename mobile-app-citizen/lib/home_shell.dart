import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/report/bao_tin_screen.dart';
import 'features/emergency/sos_screen.dart';
import 'features/status/my_reports_screen.dart';
import 'features/area_safety/area_safety_screen.dart';
import 'features/wanted/wanted_notices_screen.dart';

/// Bottom-nav shell for the 4 persistent citizen sections, plus SOS reachable via a small red
/// dot docked in the bottom bar (anh's request 2026-07-22, then trimmed down further the same
/// day — a big floating circle with an "SOS" label read as too much/oversized once seen live).
/// SOS used to be a 5th equal-weight nav tab; a distinctly-colored dot in its own gap still
/// reads as "obviously different" from routine nav icons (CLAUDE.md: SOS must never blend in)
/// without the earlier oversized glow/label — pushed as its own full-screen route rather than
/// persisted IndexedStack state, since it's a one-shot action, not a section you browse.
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
  ];

  static const _destinations = [
    (icon: Icons.campaign_outlined, activeIcon: Icons.campaign, label: 'Báo tin'),
    (icon: Icons.history, activeIcon: Icons.history, label: 'Tin của tôi'),
    (icon: Icons.map_outlined, activeIcon: Icons.map, label: 'Khu vực'),
    (icon: Icons.badge_outlined, activeIcon: Icons.badge, label: 'Truy nã'),
  ];

  void _openSos() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SosScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
            child: _BottomBar(
              destinations: _destinations,
              selectedIndex: _index,
              onSelect: (i) => setState(() => _index = i),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 9,
            child: Center(child: _SosFab(onTap: _openSos)),
          ),
        ],
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.destinations, required this.selectedIndex, required this.onSelect});

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
            BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, -2)),
          ],
        ),
        child: Row(
          children: [
            for (var i = 0; i < destinations.length; i++)
              if (i == destinations.length ~/ 2) ...[
                const SizedBox(width: 46), // gap the SOS dot sits in
                _NavItem(item: destinations[i], selected: selectedIndex == i, onTap: () => onSelect(i)),
              ] else
                _NavItem(item: destinations[i], selected: selectedIndex == i, onTap: () => onSelect(i)),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.item, required this.selected, required this.onTap});

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
            Icon(selected ? item.activeIcon : item.icon, color: color, size: 24),
            const SizedBox(height: 4),
            Text(
              item.label,
              style: TextStyle(color: color, fontSize: 11, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
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
            BoxShadow(color: Color(0x40C62828), blurRadius: 8, offset: Offset(0, 3)),
          ],
        ),
        child: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 24),
      ),
    );
  }
}
