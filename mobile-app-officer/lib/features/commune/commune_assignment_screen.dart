import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';

/// Trưởng xã (commune_head) chia nhỏ xã/phường mình phụ trách theo ranh giới cũ, gán từng
/// phần cho tài khoản cấp dưới. Mobile scope: chỉ hiển thị địa bàn của chính trưởng xã đang
/// đăng nhập (admin có bộ chọn toàn tỉnh riêng ở dashboard-web-react) — cùng quy ước "luôn
/// hiện, backend chặn qua 403" như admin_menu_screen.dart's other tiles: một cán bộ thường mở
/// màn này chỉ thấy thông báo "không phải trưởng xã" thay vì bị ẩn tab.
class CommuneAssignmentScreen extends ConsumerStatefulWidget {
  const CommuneAssignmentScreen({super.key});

  @override
  ConsumerState<CommuneAssignmentScreen> createState() => _CommuneAssignmentScreenState();
}

class _CommuneAssignmentScreenState extends ConsumerState<CommuneAssignmentScreen> {
  late Future<_CommuneData?> _future;
  String? _savingOfficerId;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_CommuneData?> _load() async {
    final repo = ref.read(communeRepositoryProvider);
    final district = await repo.myDistrict();
    if (district == null) return null;
    final districtId = district['districtId'] as String;
    final results = await Future.wait([repo.listOldWards(districtId), repo.listSubordinates(districtId)]);
    return _CommuneData(
      districtId: districtId,
      tenXa: district['tenXa'] as String,
      oldWards: results[0],
      subordinates: results[1],
    );
  }

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _assign(String districtId, String officerId, String? oldDistrictId) async {
    setState(() {
      _savingOfficerId = officerId;
      _saveError = null;
    });
    try {
      await ref.read(communeRepositoryProvider).assignSubordinate(districtId, officerId, oldDistrictId);
      await _reload();
    } catch (_) {
      if (!mounted) return;
      setState(() => _saveError = 'Gán địa bàn thất bại. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _savingOfficerId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Phân địa bàn')),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<_CommuneData?>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('Không tải được dữ liệu địa bàn.')),
                  ),
                ],
              );
            }
            final data = snapshot.data;
            if (data == null) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                      child: Text('Tài khoản này không phải trưởng xã của xã/phường nào.'),
                    ),
                  ),
                ],
              );
            }
            return ListView(
              padding: const EdgeInsets.all(12),
              children: [
                Card(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        const Icon(Icons.location_on_outlined),
                        const SizedBox(width: 8),
                        Expanded(child: Text(data.tenXa, style: const TextStyle(fontWeight: FontWeight.w700))),
                      ],
                    ),
                  ),
                ),
                if (_saveError != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(_saveError!, style: const TextStyle(color: Colors.red)),
                  ),
                const Padding(
                  padding: EdgeInsets.only(top: 12, bottom: 4),
                  child: Text('Tài khoản cấp dưới', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                if (data.subordinates.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Chưa có tài khoản cấp dưới nào trong xã/phường này.'),
                  )
                else
                  for (final s in data.subordinates)
                    _SubordinateTile(
                      subordinate: s,
                      oldWards: data.oldWards,
                      saving: _savingOfficerId == s['officerId'],
                      onAssign: (oldDistrictId) => _assign(data.districtId, s['officerId'] as String, oldDistrictId),
                    ),
                const Padding(
                  padding: EdgeInsets.only(top: 16, bottom: 4),
                  child: Text('Xã/phường cũ trong địa bàn này (cũ → mới)', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                for (final w in data.oldWards)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.history_outlined, size: 20),
                    title: Text(w['tenXa'] as String? ?? ''),
                    subtitle: Text('${w['tenHuyen'] ?? '?'} cũ'),
                    trailing: Text('${(((w['overlapRatio'] as num?) ?? 0) * 100).round()}%'),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _CommuneData {
  _CommuneData({required this.districtId, required this.tenXa, required this.oldWards, required this.subordinates});

  final String districtId;
  final String tenXa;
  final List<Map<String, dynamic>> oldWards;
  final List<Map<String, dynamic>> subordinates;
}

class _SubordinateTile extends StatelessWidget {
  const _SubordinateTile({
    required this.subordinate,
    required this.oldWards,
    required this.saving,
    required this.onAssign,
  });

  final Map<String, dynamic> subordinate;
  final List<Map<String, dynamic>> oldWards;
  final bool saving;
  final ValueChanged<String?> onAssign;

  @override
  Widget build(BuildContext context) {
    final currentOldDistrictId = subordinate['oldDistrictId'] as String?;
    // Guards against a stale currentOldDistrictId no longer present in `oldWards` (should not
    // happen — the backend validates it against the same overlap table — but a dangling
    // DropdownButton value crashes instead of just showing "Toàn bộ xã/phường mới").
    final validValue = oldWards.any((w) => w['oldDistrictId'] == currentOldDistrictId) ? currentOldDistrictId : null;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(subordinate['fullName'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : DropdownButtonFormField<String?>(
                    initialValue: validValue,
                    isExpanded: true,
                    decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
                    items: [
                      const DropdownMenuItem<String?>(value: null, child: Text('Toàn bộ xã/phường mới')),
                      for (final w in oldWards)
                        DropdownMenuItem<String?>(
                          value: w['oldDistrictId'] as String,
                          child: Text('${w['tenXa']} (${w['tenHuyen'] ?? '?'} cũ)', overflow: TextOverflow.ellipsis),
                        ),
                    ],
                    onChanged: onAssign,
                  ),
          ],
        ),
      ),
    );
  }
}
