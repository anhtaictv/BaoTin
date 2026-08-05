import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';

/// Tra cứu văn bản luật/quy định — disclaimer bắt buộc: chỉ tham khảo, không thay thế văn bản
/// gốc/tư vấn pháp lý chính thức. Kết quả luôn là nguyên văn thật (legal_lookup_repository.dart).
class LegalLookupScreen extends ConsumerStatefulWidget {
  const LegalLookupScreen({super.key});

  @override
  ConsumerState<LegalLookupScreen> createState() => _LegalLookupScreenState();
}

class _LegalLookupScreenState extends ConsumerState<LegalLookupScreen> {
  final _controller = TextEditingController();
  Future<Map<String, dynamic>>? _future;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _runLookup() {
    final query = _controller.text.trim();
    if (query.isEmpty) return;
    setState(() {
      _future = ref.read(legalLookupRepositoryProvider).lookup(query);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tra cứu văn bản luật')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tra cứu điều luật, quy định (AI cục bộ)', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              'Ví dụ: "khoản 1 điều 123 bộ luật hình sự". Chỉ mang tính tham khảo, không thay '
              'thế văn bản gốc hoặc tư vấn pháp lý chính thức.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: 'Nhập câu hỏi...',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _runLookup(),
                  ),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: _runLookup,
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                  icon: const Icon(Icons.search),
                  label: const Text('Tra cứu'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Expanded(child: _buildResults(context)),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(BuildContext context) {
    final future = _future;
    if (future == null) {
      return const Center(child: Text('Nhập câu hỏi và bấm Tra cứu.'));
    }
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError || snapshot.data == null) {
          return const Center(child: Text('Không thực hiện được tra cứu. Vui lòng thử lại.'));
        }
        final data = snapshot.data!;
        final available = data['available'] as bool? ?? false;
        if (!available) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Không hiểu được câu hỏi này (hoặc tính năng AI cục bộ chưa được cấu hình — '
                'cần LLM_PROVIDER=ollama ở backend). Hãy thử diễn đạt rõ hơn, ví dụ nêu rõ '
                'số điều/khoản và tên bộ luật.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        }

        final results = List<Map<String, dynamic>>.from(data['results'] as List? ?? []);
        if (results.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Không tìm thấy điều luật phù hợp trong dữ liệu hiện có.', textAlign: TextAlign.center),
            ),
          );
        }

        return ListView(
          children: [
            for (final result in results)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${result['documentTitle']}'
                        '${result['documentNumber'] != null ? ' (${result['documentNumber']})' : ''}',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Điều ${result['articleNumber']}. ${result['articleTitle']}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(result['text'] as String? ?? ''),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
