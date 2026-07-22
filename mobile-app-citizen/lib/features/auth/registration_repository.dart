import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import '../../core/secure_token_store.dart';

/// Username/password registration+login — a NEW path alongside the OTP flow
/// (auth_repository.dart), matching the backend's auth/registration.routes.ts. Both stay
/// available side by side; neither touches the other.
class RegistrationRepository {
  RegistrationRepository(this._apiClient, this._tokenStore);

  final ApiClient _apiClient;
  final SecureTokenStore _tokenStore;

  Future<void> registerCitizen({
    required String username,
    required String password,
    required String fullName,
    required String phoneNumber,
    required String cccdNumber,
    required String address,
    required Uint8List cccdFrontBytes,
    required String cccdFrontFilename,
    required Uint8List cccdBackBytes,
    required String cccdBackFilename,
  }) async {
    final formData = FormData.fromMap({
      'username': username,
      'password': password,
      'fullName': fullName,
      'phoneNumber': phoneNumber,
      'cccdNumber': cccdNumber,
      'address': address,
      'cccdFront': MultipartFile.fromBytes(cccdFrontBytes, filename: cccdFrontFilename),
      'cccdBack': MultipartFile.fromBytes(cccdBackBytes, filename: cccdBackFilename),
    });

    final res = await _apiClient.dio.post('/auth/register/citizen', data: formData);
    final data = res.data['data'] as Map<String, dynamic>;
    await _tokenStore.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  }

  Future<void> loginCitizen({required String username, required String password}) async {
    final res = await _apiClient.dio.post(
      '/auth/login/citizen',
      data: {'username': username, 'password': password},
    );
    final data = res.data['data'] as Map<String, dynamic>;
    await _tokenStore.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  }
}
