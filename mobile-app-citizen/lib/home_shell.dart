import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/bao_tin_badge.dart';
import 'core/providers.dart';
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
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  @override
  void initState() {
    super.initState();
    // App-foreground sync only (no background service/WorkManager) — good enough for a
    // citizen app: flush whatever's queued as soon as the app starts, then again any time
    // connectivity comes back while it's open.
    ref.read(pendingReportsQueueProvider).flush();
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((r) => r != ConnectivityResult.none)) {
        ref.read(pendingReportsQueueProvider).flush();
      }
    });
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    super.dispose();
  }

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
      body: IndexedStack(index: _index, children: _screens),
      // The real bottomNavigationBar slot (not a hand-positioned Stack overlay) — Scaffold
      // animates this smoothly against the keyboard on its own, which is what fixed the
      // jumping bar; a Positioned overlay doesn't participate in that built-in animation.
      bottomNavigationBar: _CitizenNavBar(
        destinations: _destinations,
        selectedIndex: _index,
        onSelect: (i) => setState(() => _index = i),
        onSos: _openSos,
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

/// Same icon-only / tap-to-reveal-label pattern as mobile-app-officer's home_shell.dart
/// _AnimatedNavBar. SOS rides along at the end instead of floating above a centered gap in
/// the row — it doesn't need centering, just to read as the most prominent, fastest thing to
/// hit, so it's a bigger solid-red circle instead of matching the other (icon-only-until-
/// tapped) nav items.
class _CitizenNavBar extends StatelessWidget {
  const _CitizenNavBar({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
    required this.onSos,
  });

  final List<({IconData icon, IconData activeIcon, String label})> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final VoidCallback onSos;

  static const _selectedWidth = 116.0;
  static const _sosWidth = 68.0;
  static const _slideDuration = Duration(milliseconds: 260);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        height: 60,
        decoration: BoxDecoration(
          color: Colors.white,
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
                (constraints.maxWidth - _selectedWidth - _sosWidth) / (destinations.length - 1);
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
                    child: _CitizenNavItem(
                      item: destinations[i],
                      selected: i == selectedIndex,
                      onTap: () => onSelect(i),
                    ),
                  ),
                SizedBox(width: _sosWidth, child: Center(child: _SosButton(onTap: onSos))),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _CitizenNavItem extends StatelessWidget {
  const _CitizenNavItem(
      {required this.item, required this.selected, required this.onTap});

  final ({IconData icon, IconData activeIcon, String label}) item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? BaoTinTheme.primary : Colors.grey.shade500;
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

class _SosButton extends StatelessWidget {
  const _SosButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: BaoTinTheme.primary,
          boxShadow: [
            BoxShadow(
                color: Color(0x40C62828), blurRadius: 10, offset: Offset(0, 3)),
          ],
        ),
        child: const Icon(Icons.warning_amber_rounded,
            color: Colors.white, size: 26),
      ),
    );
  }
}
