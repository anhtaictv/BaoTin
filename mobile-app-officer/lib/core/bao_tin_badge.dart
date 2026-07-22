import 'package:flutter/material.dart';

/// Original Báo Tin badge — same red/gold brand mark as mobile-app-citizen (kept in the
/// citizen app's own red so the two apps share one recognizable identity even though the
/// officer app's chrome is navy), deliberately NOT the Công An Nhân Dân seal/emblem:
/// reproducing the real government crest on an independent app would misrepresent Báo Tin as
/// an official police channel.
class BaoTinBadge extends StatelessWidget {
  const BaoTinBadge({super.key, this.size = 120});

  final double size;

  static const _red = Color(0xFFC62828);
  static const _redDark = Color(0xFF8E1C1C);
  static const _gold = Color(0xFFE3C169);

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
              colors: [_red, _redDark],
            ),
          ),
          child: Padding(
            padding: EdgeInsets.only(top: size * 0.16, bottom: size * 0.12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.campaign_rounded, color: _gold, size: size * 0.4),
                SizedBox(height: size * 0.04),
                Text(
                  'BÁO TIN',
                  style: TextStyle(
                    color: _gold,
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
