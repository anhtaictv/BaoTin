import 'package:flutter/material.dart';
import '../../../core/theme.dart';

const _queueOrder = ['pending', 'sent', 'fulfilled', 'rejected'];

/// v1.1 camera-extraction queue — 4 small counts, no target/threshold to compare against,
/// so plain stat tiles (not a bullet/gauge chart) per dataviz's "KPI single number → stat
/// tile" guidance.
class CameraQueueTiles extends StatelessWidget {
  const CameraQueueTiles({super.key, required this.byStatus});

  final Map<String, dynamic> byStatus;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(DashboardTheme.cardPadding + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.videocam_outlined, size: 16, color: DashboardTheme.accent),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Hàng đợi yêu cầu trích xuất camera',
                    style: Theme.of(context).textTheme.titleMedium,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: DashboardTheme.gridGap * 2,
              runSpacing: DashboardTheme.gridGap * 2,
              children: [
                for (final status in _queueOrder)
                  _QueueTile(
                    label: extractionStatusLabel(status),
                    count: (byStatus[status] as num?)?.toInt() ?? 0,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QueueTile extends StatelessWidget {
  const _QueueTile({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DashboardTheme.backgroundLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: DashboardTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$count', style: Theme.of(context).textTheme.displaySmall?.copyWith(fontSize: 22)),
          const SizedBox(height: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
