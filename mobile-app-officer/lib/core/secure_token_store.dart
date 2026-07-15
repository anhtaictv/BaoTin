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

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
