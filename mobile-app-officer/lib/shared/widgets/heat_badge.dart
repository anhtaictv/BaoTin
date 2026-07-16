import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// Giai đoạn 4 "độ nóng tin MXH" — chỉ hiển thị khi tín hiệu đã xác định được địa bàn
/// (heat luôn null nếu không, xem signals.service.ts). Chỉ mang tính tham khảo mật độ tin
/// tức trong khu vực, không phải kết luận về mức độ nghiêm trọng của bất kỳ vụ việc nào.
class HeatBadge extends StatelessWidget {
  const HeatBadge({super.key, required this.level, required this.score});

  final String level;
  final int score;

  @override
  Widget build(BuildContext context) {
    final color = heatLevelColor(level);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.local_fire_department, size: 12, color: color),
          const SizedBox(width: 3),
          Text(
            '${heatLevelLabel(level)} ($score)',
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
