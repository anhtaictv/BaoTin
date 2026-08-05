import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// Renders a report's status consistently everywhere it appears (list, detail) —
/// same color + label mapping as the officer app, so the two never disagree visually.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status, this.isAssigned = false});

  final String status;

  /// Only matters for 'pending' — distinguishes "Mới gửi" from "Đã định tuyến". Defaults to
  /// false so existing call sites without an assignment context keep their old behavior.
  final bool isAssigned;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status, isAssigned: isAssigned);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        statusLabel(status, isAssigned: isAssigned),
        style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12),
      ),
    );
  }
}
