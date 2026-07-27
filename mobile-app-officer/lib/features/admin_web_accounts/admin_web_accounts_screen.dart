import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';

/// Admin-only — roster of `web_accounts` (username/password provisioned in bulk for all 102
/// xã/phường, backend/prisma/seed/seed-web-accounts.ts). Ported from dashboard-web-react's
/// AdminAccountsPage.tsx. Resetting a password shows the new one-time temp password exactly
/// once — it is never stored or shown again after leaving this screen.
class AdminWebAccountsScreen extends ConsumerStatefulWidget {
  const AdminWebAccountsScreen({super.key});

  @override
  ConsumerState<AdminWebAccountsScreen> createState() => _AdminWebAccountsScreenState();
}

class _AdminWebAccountsScreenState extends ConsumerState<AdminWebAccountsScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  String? _resettingId;
  ({String username, String tempPassword})? _resetResult;
  String? _resetError;

  @override
  void initState() {
    super.initState();
    _future = ref.read(webAccountRepositoryProvider).listAccounts();
  }

  Future<void> _reload() async {
    setState(() => _future = ref.read(webAccountRepositoryProvider).listAccounts());
    await _future;
  }

  Future<void> _reset(String officerId, String username) async {
    setState(() {
      _resettingId = officerId;
      _resetError = null;
    });
    try {
      final tempPassword = await ref.read(webAccountRepositoryProvider).resetPassword(officerId);
      if (!mounted) return;
      setState(() => _resetResult = (username: username, tempPassword: tempPassword));
    } catch (_) {
      if (!mounted) return;
      setState(() => _resetError = 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _resettingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quản lý tài khoản (102 xã)')),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<List<Map<String, dynamic>>>(
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
                    child: Center(child: Text('Không tải được danh sách tài khoản.')),
                  ),
                ],
              );
            }
            final accounts = snapshot.data ?? [];
            return ListView(
              padding: const EdgeInsets.all(12),
              children: [
                if (_resetResult != null) _TempPasswordCard(result: _resetResult!, onClose: () => setState(() => _resetResult = null)),
                if (_resetError != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(_resetError!, style: const TextStyle(color: Colors.red)),
                  ),
                if (accounts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('Chưa có tài khoản nào.')),
                  )
                else
                  for (final account in accounts)
                    _AccountTile(
                      account: account,
                      resetting: _resettingId == account['officerId'],
                      onReset: () => _reset(account['officerId'] as String, account['username'] as String),
                    ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({required this.account, required this.resetting, required this.onReset});

  final Map<String, dynamic> account;
  final bool resetting;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final districts = List<String>.from(account['districts'] as List? ?? []);
    final isLocked = account['isLocked'] as bool? ?? false;
    final mustChangePassword = account['mustChangePassword'] as bool? ?? false;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(account['username'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(account['fullName'] as String? ?? '', style: Theme.of(context).textTheme.bodySmall),
                      if (districts.isNotEmpty)
                        Text(districts.join(', '), style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                OutlinedButton(
                  onPressed: resetting ? null : onReset,
                  // See search_screen.dart's FilledButton override for why this is needed —
                  // OutlinedButtonTheme has the same Size.fromHeight(52) (infinite width)
                  // default, which breaks this Row's Expanded sibling.
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
                  child: resetting
                      ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Đặt lại mật khẩu'),
                ),
              ],
            ),
            if (isLocked || mustChangePassword) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                children: [
                  if (isLocked)
                    const Chip(
                      label: Text('Đang khoá', style: TextStyle(fontSize: 11)),
                      visualDensity: VisualDensity.compact,
                    ),
                  if (mustChangePassword)
                    const Chip(
                      label: Text('Chưa đổi mật khẩu', style: TextStyle(fontSize: 11)),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TempPasswordCard extends StatelessWidget {
  const _TempPasswordCard({required this.result, required this.onClose});

  final ({String username, String tempPassword}) result;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.amber.shade50,
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Mật khẩu tạm mới cho ${result.username}', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            SelectableText(
              result.tempPassword,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, letterSpacing: 1),
            ),
            const SizedBox(height: 6),
            const Text(
              'Chỉ hiển thị 1 lần duy nhất — hãy bàn giao ngay cho cán bộ.',
              style: TextStyle(fontSize: 12),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(onPressed: onClose, child: const Text('Đóng')),
            ),
          ],
        ),
      ),
    );
  }
}
