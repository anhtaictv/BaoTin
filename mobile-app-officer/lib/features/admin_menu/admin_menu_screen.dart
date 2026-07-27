import 'package:flutter/material.dart';
import '../analytics/admin_analytics_screen.dart';
import '../auth/pending_officers_screen.dart';
import '../auth/change_password_screen.dart';
import '../admin_citizens/locked_citizens_screen.dart';
import '../search/search_screen.dart';
import '../admin_web_accounts/admin_web_accounts_screen.dart';

/// Groups the 3 admin/senior_officer-only screens (previously 3 separate bottom-nav tabs,
/// crowding it to 10 alongside the 7 everyone-uses tabs) behind one "Quản trị" entry point.
/// Same "always visible, backend enforces via 403" convention as the screens it links to.
/// "Đổi mật khẩu" lives here too even though it's self-service for every role, not
/// admin-only — this is the closest thing this app has to an account-settings area, and the
/// backend enforces "only your own account" regardless of who opens the tile.
class AdminMenuScreen extends StatelessWidget {
  const AdminMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quản trị')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _AdminMenuTile(
            icon: Icons.bar_chart_outlined,
            title: 'Thống kê',
            subtitle: 'Biểu đồ phân loại, xu hướng, xếp hạng địa bàn',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AdminAnalyticsScreen()),
            ),
          ),
          _AdminMenuTile(
            icon: Icons.how_to_reg_outlined,
            title: 'Duyệt tài khoản cán bộ',
            subtitle: 'Duyệt hoặc từ chối cán bộ tự đăng ký',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PendingOfficersScreen()),
            ),
          ),
          _AdminMenuTile(
            icon: Icons.lock_open_outlined,
            title: 'Tài khoản bị khóa',
            subtitle: 'Mở khóa tài khoản dân bị khóa do báo tin sai nhiều lần',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const LockedCitizensScreen()),
            ),
          ),
          _AdminMenuTile(
            icon: Icons.travel_explore_outlined,
            title: 'Trợ lý tìm kiếm',
            subtitle: 'Tìm tin báo/tín hiệu bằng câu hỏi tiếng Việt tự nhiên (AI cục bộ)',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SearchScreen()),
            ),
          ),
          _AdminMenuTile(
            icon: Icons.groups_2_outlined,
            title: 'Quản lý tài khoản (102 xã)',
            subtitle: 'Danh sách tài khoản admin cấp sẵn, đặt lại mật khẩu',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AdminWebAccountsScreen()),
            ),
          ),
          _AdminMenuTile(
            icon: Icons.password_outlined,
            title: 'Đổi mật khẩu',
            subtitle: 'Áp dụng cho mọi tài khoản, không chỉ quản trị viên',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminMenuTile extends StatelessWidget {
  const _AdminMenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: colors.primaryContainer,
          child: Icon(icon, color: colors.onPrimaryContainer),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
