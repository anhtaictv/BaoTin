import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// Deliberately a different shape/style from StatusBadge (Signal has no verification
/// status — CLAUDE.md #1: never render a Signal so it could be mistaken for a Report).
class TrustLevelBadge extends StatelessWidget {
  const TrustLevelBadge({super.key, required this.trustLevel});

  final String trustLevel;

  @override
  Widget build(BuildContext context) {
    final color = trustLevelColor(trustLevel);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        trustLevelLabel(trustLevel),
        style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 11),
      ),
    );
  }
}
