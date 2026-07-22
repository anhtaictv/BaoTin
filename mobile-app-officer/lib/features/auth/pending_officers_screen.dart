import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';

/// Admin-only (backend requireAuth(["admin"])). No client-side role check exists elsewhere in
/// this app — same convention as wanted_notices_screen.dart: the tab is always visible, and a
/// non-admin gets a clear message from the 403 instead of the backend's generic one.
class PendingOfficersScreen extends ConsumerStatefulWidget {
  const PendingOfficersScreen({super.key});

  @override
  ConsumerState<PendingOfficersScreen> createState() => _PendingOfficersScreenState();
}

class _PendingOfficersScreenState extends ConsumerState<PendingOfficersScreen> {
  Future<List<Map<String, dynamic>>>? _future;
  List<Map<String, dynamic>> _districts = [];
  String? _forbiddenMessage;
  final Set<String> _acting = {};
  // districtId chosen so far, keyed by pending officer id — required before "Duyệt" is enabled
  // (a self-registered officer has zero district assignments until approval sets one).
  final Map<String, String> _chosenDistrict = {};

  @override
  void initState() {
    super.initState();
    _refresh();
    ref.read(officerRegistrationRepositoryProvider).listDistricts().then((value) {
      if (mounted) setState(() => _districts = value);
    }).catchError((Object _) {});
  }

  void _refresh() {
    setState(() {
      _forbiddenMessage = null;
      _future = ref.read(officerRegistrationRepositoryProvider).listPendingOfficers().catchError((Object e) {
        if (e is DioException && e.response?.statusCode == 403) {
          setState(() => _forbiddenMessage = 'Chỉ quản trị viên mới xem được danh sách chờ duyệt.');
          return <Map<String, dynamic>>[];
        }
        throw e;
      });
    });
  }

  Future<void> _approve(String officerId) async {
    final districtId = _chosenDistrict[officerId];
    if (districtId == null) return;
    setState(() => _acting.add(officerId));
    try {
      await ref.read(officerRegistrationRepositoryProvider).approve(officerId, districtId);
      if (!mounted) return;
      _refresh();
    } on DioException catch (e) {
      if (!mounted) return;
      final message = e.response?.statusCode == 403
          ? 'Chỉ quản trị viên mới thực hiện được thao tác này.'
          : 'Duyệt thất bại, thử lại sau.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _acting.remove(officerId));
    }
  }

  Future<void> _reject(String officerId) async {
    setState(() => _acting.add(officerId));
    try {
      await ref.read(officerRegistrationRepositoryProvider).reject(officerId);
      if (!mounted) return;
      _refresh();
    } on DioException catch (e) {
      if (!mounted) return;
      final message = e.response?.statusCode == 403
          ? 'Chỉ quản trị viên mới thực hiện được thao tác này.'
          : 'Thao tác thất bại, thử lại sau.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _acting.remove(officerId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Duyệt tài khoản cán bộ')),
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
            final pending = snapshot.data ?? const [];
            if (pending.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.how_to_reg_outlined, size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Không có tài khoản nào chờ duyệt.', style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: pending.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final officer = pending[index];
                final id = officer['id'] as String;
                final busy = _acting.contains(id);
                final selectedDistrict = _chosenDistrict[id];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(officer['fullName'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text('Tên đăng nhập: ${officer['username']}'),
                        Text('SĐT: ${officer['phoneNumber']}'),
                        Text('CCCD/CMND: ${officer['cccdNumber']}'),
                        Text('Địa chỉ: ${officer['address']}'),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: selectedDistrict,
                          decoration: const InputDecoration(labelText: 'Địa bàn phụ trách', isDense: true),
                          items: _districts
                              .map((d) => DropdownMenuItem(
                                    value: d['id'] as String,
                                    child: Text(d['tenXa'] as String),
                                  ))
                              .toList(),
                          onChanged: (value) => setState(() {
                            if (value != null) _chosenDistrict[id] = value;
                          }),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton(
                                onPressed: (busy || selectedDistrict == null) ? null : () => _approve(id),
                                child: const Text('Duyệt'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: busy ? null : () => _reject(id),
                                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                                child: const Text('Từ chối'),
                              ),
                            ),
                          ],
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
