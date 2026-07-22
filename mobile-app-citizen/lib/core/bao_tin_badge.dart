import 'package:flutter/material.dart';
import 'theme.dart';

/// Original Báo Tin badge — a shield silhouette in the same red/gold language as the
/// reference "SOS An ninh trật tự" app, but its own design. Deliberately NOT the Công An
/// Nhân Dân seal/emblem: reproducing the real government crest on an independent, unofficial
/// app would misrepresent Báo Tin as an official police channel (CLAUDE.md: "bổ trợ VNeID,
/// không thay thế" — Báo Tin is a citizen tool alongside official channels, not one of them).
class BaoTinBadge extends StatelessWidget {
  const BaoTinBadge({super.key, this.size = 120});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size * 1.12,
      child: ClipPath(
        clipper: _ShieldClipper(),
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [BaoTinTheme.primary, BaoTinTheme.primaryDark],
            ),
          ),
          child: Padding(
            padding: EdgeInsets.only(top: size * 0.16, bottom: size * 0.12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.campaign_rounded, color: BaoTinTheme.gold, size: size * 0.4),
                SizedBox(height: size * 0.04),
                Text(
                  'BÁO TIN',
                  style: TextStyle(
                    color: BaoTinTheme.gold,
                    fontWeight: FontWeight.w900,
                    fontSize: size * 0.15,
                    letterSpacing: 1,
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

/// A simple shield outline: flat top corners, straight sides, pointed bottom — same overall
/// proportions as a police-badge silhouette without tracing any specific real emblem.
class _ShieldClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.08, 0)
      ..lineTo(w * 0.92, 0)
      ..lineTo(w * 0.92, h * 0.55)
      ..quadraticBezierTo(w * 0.92, h * 0.75, w * 0.5, h)
      ..quadraticBezierTo(w * 0.08, h * 0.75, w * 0.08, h * 0.55)
      ..close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
