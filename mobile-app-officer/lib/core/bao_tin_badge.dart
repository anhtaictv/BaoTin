import 'package:flutter/material.dart';

/// Báo Tin badge — renders the app's official logo (assets/logo.png), same asset as
/// mobile-app-citizen so both apps share one identity.
class BaoTinBadge extends StatelessWidget {
  const BaoTinBadge({super.key, this.size = 120});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: Image.asset('assets/logo.png', width: size, height: size, fit: BoxFit.cover),
    );
  }
}
