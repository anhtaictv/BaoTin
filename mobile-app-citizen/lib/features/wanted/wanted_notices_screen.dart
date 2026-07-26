import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';

/// "Lệnh truy nã" — official notices posted by senior_officer/admin (see mobile-app-officer),
/// read-only here. Any logged-in citizen can view (backend requireAuth([])); the photo itself
/// carries all identifying info, so this screen is deliberately just a gallery + full-screen
/// viewer, no extra fields.
class WantedNoticesScreen extends ConsumerStatefulWidget {
  const WantedNoticesScreen({super.key});

  @override
  ConsumerState<WantedNoticesScreen> createState() => _WantedNoticesScreenState();
}

class _WantedNoticesScreenState extends ConsumerState<WantedNoticesScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(wantedNoticesRepositoryProvider).list();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = ref.read(wantedNoticesRepositoryProvider).list();
    });
    await _future;
  }

  void _openFullPhoto(String url) {
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: InteractiveViewer(
          child: Image.network(
            url,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Lệnh truy nã')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            final notices = snapshot.data ?? const [];
            if (notices.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.badge_outlined, size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Chưa có lệnh truy nã nào.', style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            return GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.85,
              ),
              itemCount: notices.length,
              itemBuilder: (context, index) {
                final notice = notices[index];
                final url = notice['photoUrl'] as String;
                return InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => _openFullPhoto(url),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(
                            url,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: colors.surfaceContainerHighest,
                              alignment: Alignment.center,
                              child: Icon(Icons.broken_image_outlined, color: colors.onSurfaceVariant),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _formatDate(notice['createdAt'] as String?),
                        style: TextStyle(fontSize: 11, color: colors.onSurfaceVariant),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('dd/MM/yyyy').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
