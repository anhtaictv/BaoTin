import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/providers.dart';

/// Tin chính thức từ bocongan.gov.vn — đọc nguyên văn, tách hẳn khỏi luồng tin dân báo/đã xác
/// thực (CLAUDE.md #1/#2). Mở bài viết gốc bằng trình duyệt ngoài thay vì nhúng WebView —
/// không cần thêm dependency, và tránh mọi hiểu lầm rằng đây là nội dung do app kiểm duyệt.
class NewsScreen extends ConsumerStatefulWidget {
  const NewsScreen({super.key});

  @override
  ConsumerState<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends ConsumerState<NewsScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(newsRepositoryProvider).list();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = ref.read(newsRepositoryProvider).list();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Tin tức')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.error_outline, size: 40, color: colors.error),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Không tải được tin tức. Kéo xuống để thử lại.',
                        style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            final items = snapshot.data ?? const [];
            if (items.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.newspaper_outlined, size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Chưa có tin tức nào.', style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) => _NewsCard(item: items[index]),
            );
          },
        ),
      ),
    );
  }
}

class _NewsCard extends StatelessWidget {
  const _NewsCard({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final title = item['title'] as String? ?? '';
    final summary = item['summary'] as String? ?? '';
    final link = item['link'] as String?;
    final linkUri = link == null ? null : Uri.tryParse(link);
    final isValidLink = linkUri != null && (linkUri.scheme == 'http' || linkUri.scheme == 'https');
    final publishedAt = _formatDate(item['publishedAt'] as String?);

    return Material(
      color: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: isValidLink
            ? () => launchUrl(linkUri, mode: LaunchMode.externalApplication)
            : null,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.newspaper_outlined, size: 14, color: colors.primary),
                  const SizedBox(width: 6),
                  Text('Bộ Công an',
                      style: TextStyle(fontSize: 11, color: colors.primary, fontWeight: FontWeight.w700)),
                  if (publishedAt.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Text(publishedAt, style: TextStyle(fontSize: 11, color: colors.onSurfaceVariant)),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              if (summary.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  summary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.onSurfaceVariant, fontSize: 13),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return '';
  }
}
