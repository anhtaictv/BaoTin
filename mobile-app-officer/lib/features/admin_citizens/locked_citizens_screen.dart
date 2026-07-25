import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';

/// Admin-only (backend requireAuth(["admin"])). Same "always visible, backend enforces via
/// 403" convention as pending_officers_screen.dart. Lists accounts officerReports.service.ts
/// auto-locked after 4 confirmed_false reports, with a button to lift the lock.
class LockedCitizensScreen extends ConsumerStatefulWidget {
  const LockedCitizensScreen({super.key});

  @override
  ConsumerState<LockedCitizensScreen> createState() => _LockedCitizensScreenState();
}

class _LockedCitizensScreenState extends ConsumerState<LockedCitizensScreen> {
  Future<List<Map<String, dynamic>>>? _future;
  String? _forbiddenMessage;
  final Set<String> _acting = {};

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  void _refresh() {
    setState(() {
      _forbiddenMessage = null;
      _future = ref.read(lockedCitizensRepositoryProvider).listLocked().catchError((Object e) {
        if (e is DioException && e.response?.statusCode == 403) {
          setState(() => _forbiddenMessage = 'Chỉ quản trị viên mới xem được danh sách tài khoản bị khóa.');
          return <Map<String, dynamic>>[];
        }
        throw e;
      });
    });
  }

  Future<void> _unlock(String userId) async {
    setState(() => _acting.add(userId));
    try {
      await ref.read(lockedCitizensRepositoryProvider).unlock(userId);
      if (!mounted) return;
      _refresh();
    } on DioException catch (e) {
      if (!mounted) return;
      final message = e.response?.statusCode == 403
          ? 'Chỉ quản trị viên mới thực hiện được thao tác này.'
          : 'Mở khóa thất bại, thử lại sau.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _acting.remove(userId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Tài khoản bị khóa')),
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await _future;
        },
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (_forbiddenMessage != null) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.lock_outline, size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text(_forbiddenMessage!, style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            final locked = snapshot.data ?? const [];
            if (locked.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.lock_open_outlined, size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Không có tài khoản nào đang bị khóa.', style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: locked.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final citizen = locked[index];
                final id = citizen['id'] as String;
                final busy = _acting.contains(id);
                final falseCount = citizen['falseReportCount'] as int? ?? 0;
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (citizen['fullName'] as String?) ?? '(Chưa có tên)',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text('SĐT: ${citizen['phoneNumber']}'),
                        if (citizen['username'] != null) Text('Tên đăng nhập: ${citizen['username']}'),
                        Text('Số tin báo bị xác nhận sai: $falseCount'),
                        Text('Khóa lúc: ${_formatDate(citizen['lockedAt'] as String?)}'),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: busy ? null : () => _unlock(id),
                            icon: const Icon(Icons.lock_open),
                            label: const Text('Mở khóa'),
                          ),
                        ),
                      ],
                    ),
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
    return DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return iso;
  }
}
