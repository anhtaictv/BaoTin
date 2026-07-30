import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

/// A single channel's message history + composer. `districtId` is null for the general
/// channel; the backend rejects (403) any attempt to read/send on a district channel this
/// account isn't allowed into, same "let the 403 fail" pattern as the rest of this app.
class ChatThreadScreen extends ConsumerStatefulWidget {
  const ChatThreadScreen({super.key, required this.channelType, this.districtId, required this.title});

  final String channelType;
  final String? districtId;
  final String title;

  @override
  ConsumerState<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends ConsumerState<ChatThreadScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _sending = false;
  bool _hasMore = false;
  String? _officerId;
  String? _error;

  static const _pageSize = 50;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final officerId = await ref.read(chatRepositoryProvider).currentOfficerId();
      final messages = await ref.read(chatRepositoryProvider).listMessages(
            channelType: widget.channelType,
            districtId: widget.districtId,
          );
      if (!mounted) return;
      setState(() {
        _officerId = officerId;
        _messages = messages;
        _hasMore = messages.length >= _pageSize;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Không tải được tin nhắn.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_messages.isEmpty) return;
    setState(() => _loadingMore = true);
    try {
      final oldest = DateTime.parse(_messages.last['createdAt'] as String);
      final older = await ref.read(chatRepositoryProvider).listMessages(
            channelType: widget.channelType,
            districtId: widget.districtId,
            before: oldest,
          );
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, ...older];
        _hasMore = older.length >= _pageSize;
      });
    } catch (_) {
      // Best-effort — the thread already shown stays usable even if "load more" fails once.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _send() async {
    final content = _messageController.text.trim();
    if (content.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final sent = await ref.read(chatRepositoryProvider).sendMessage(
            channelType: widget.channelType,
            districtId: widget.districtId,
            content: content,
          );
      if (!mounted) return;
      _messageController.clear();
      setState(() => _messages = [sent, ..._messages]);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gửi tin nhắn thất bại, thử lại sau.')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: TextStyle(color: colors.onSurfaceVariant)))
                    : _messages.isEmpty
                        ? Center(
                            child: Text('Chưa có tin nhắn nào. Hãy bắt đầu trao đổi.',
                                style: TextStyle(color: colors.onSurfaceVariant)),
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            reverse: true,
                            padding: const EdgeInsets.all(12),
                            itemCount: _messages.length + (_hasMore ? 1 : 0),
                            itemBuilder: (context, index) {
                              if (index == _messages.length) {
                                return Center(
                                  child: TextButton(
                                    onPressed: _loadingMore ? null : _loadMore,
                                    child: _loadingMore
                                        ? const SizedBox(
                                            width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                        : const Text('Tải thêm tin nhắn cũ hơn'),
                                  ),
                                );
                              }
                              final message = _messages[index];
                              final isMine = message['senderId'] == _officerId;
                              return _MessageBubble(message: message, isMine: isMine);
                            },
                          ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(hintText: 'Nhập tin nhắn...'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FloatingActionButton.small(
                    onPressed: _sending ? null : _send,
                    child: _sending
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.isMine});

  final Map<String, dynamic> message;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (!isMine)
            Padding(
              padding: const EdgeInsets.only(left: 12, bottom: 2),
              child: Text(
                message['senderName'] as String? ?? '',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade600),
              ),
            ),
          Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
            children: [
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isMine ? BaoTinOfficerTheme.primary : Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: isMine ? null : Border.all(color: Theme.of(context).dividerColor),
                  ),
                  child: Text(
                    message['content'] as String? ?? '',
                    style: TextStyle(color: isMine ? Colors.white : Theme.of(context).colorScheme.onSurface),
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
            child: Text(_formatTime(message['createdAt'] as String?), style: const TextStyle(fontSize: 10, color: Colors.grey)),
          ),
        ],
      ),
    );
  }
}

String _formatTime(String? iso) {
  if (iso == null) return '';
  try {
    return DateFormat('HH:mm dd/MM').format(DateTime.parse(iso).toLocal());
  } catch (_) {
    return '';
  }
}
