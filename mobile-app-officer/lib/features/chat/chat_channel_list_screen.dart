import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import 'chat_thread_screen.dart';

/// Bottom-nav "Chat" tab — cross-unit communication (không phải kênh bằng chứng/tin báo).
/// Which channels appear here is entirely the backend's call (general + whichever district
/// channels this account may access, see chat.service.ts listChannels) — a plain officer
/// typically sees "Chung" + their own đơn vị, admin/senior_officer see every đơn vị with an
/// assigned officer.
class ChatChannelListScreen extends ConsumerStatefulWidget {
  const ChatChannelListScreen({super.key});

  @override
  ConsumerState<ChatChannelListScreen> createState() => _ChatChannelListScreenState();
}

class _ChatChannelListScreenState extends ConsumerState<ChatChannelListScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(chatRepositoryProvider).listChannels();
  }

  void _refresh() => setState(() {
        _future = ref.read(chatRepositoryProvider).listChannels();
      });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Chat')),
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
            if (snapshot.hasError) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Center(
                    child: Text('Không tải được danh sách kênh chat.', style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            final channels = snapshot.data ?? const [];
            if (channels.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 100),
                  Icon(Icons.forum_outlined, size: 40, color: colors.onSurfaceVariant),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Chưa có kênh chat nào.', style: TextStyle(color: colors.onSurfaceVariant)),
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: channels.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) => _ChannelTile(channel: channels[index]),
            );
          },
        ),
      ),
    );
  }
}

class _ChannelTile extends StatelessWidget {
  const _ChannelTile({required this.channel});

  final Map<String, dynamic> channel;

  @override
  Widget build(BuildContext context) {
    final channelType = channel['channelType'] as String;
    final isGeneral = channelType == 'general';
    final label = isGeneral ? 'Chung' : (channel['districtName'] as String? ?? 'Đơn vị');
    final lastMessage = channel['lastMessage'] as Map<String, dynamic>?;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: BaoTinOfficerTheme.primary.withValues(alpha: 0.1),
        child: Icon(
          isGeneral ? Icons.campaign_outlined : Icons.apartment_outlined,
          color: BaoTinOfficerTheme.primary,
        ),
      ),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: lastMessage == null
          ? const Text('Chưa có tin nhắn nào.')
          : Text(
              '${lastMessage['senderName']}: ${lastMessage['content']}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
      trailing: lastMessage != null
          ? Text(_formatTime(lastMessage['createdAt'] as String?), style: const TextStyle(fontSize: 11))
          : null,
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ChatThreadScreen(
            channelType: channelType,
            districtId: channel['districtId'] as String?,
            title: label,
          ),
        ),
      ),
    );
  }
}

String _formatTime(String? iso) {
  if (iso == null) return '';
  try {
    final date = DateTime.parse(iso).toLocal();
    final now = DateTime.now();
    final sameDay = date.year == now.year && date.month == now.month && date.day == now.day;
    return sameDay ? DateFormat('HH:mm').format(date) : DateFormat('dd/MM').format(date);
  } catch (_) {
    return '';
  }
}
