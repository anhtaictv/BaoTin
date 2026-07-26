import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Access/refresh tokens live in Keychain (iOS) / Keystore (Android) — never
/// SharedPreferences. Officer accounts hold more sensitive access than citizen accounts,
/// so this is at least as important here as in mobile-app-citizen.
class SecureTokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'bao_tin_officer_access_token';
  static const _refreshTokenKey = 'bao_tin_officer_refresh_token';

  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  /// Decodes the `sub` claim out of the stored access token — display only (e.g. telling
  /// "my" chat bubbles apart from everyone else's), never a security decision: every backend
  /// endpoint still re-derives identity from the signature-verified JWT server-side.
  Future<String?> readOfficerId() async {
    final token = await readAccessToken();
    if (token == null) return null;
    final parts = token.split('.');
    if (parts.length != 3) return null;
    try {
      final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
      return (payload as Map<String, dynamic>)['sub'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
