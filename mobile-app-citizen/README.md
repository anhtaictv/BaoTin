# mobile-app-citizen

Flutter app cho người dân — Báo tin / Cấp cứu (SOS) / Tin của tôi.

## Trạng thái

Đã scaffold `android/`, `ios/`, `web/` (bỏ `windows/`, `linux/`, `macos/` — không cần cho scope
hiện tại và né được lỗi symlink/native-assets trên Windows, xem ghi chú dưới). Quyền camera/vị
trí đã thêm sẵn vào `android/app/src/main/AndroidManifest.xml` và `ios/Runner/Info.plist`.

Đã xác nhận (trên máy dev có Flutter 3.44.6):
```
flutter analyze   → No issues found!
flutter test      → All tests passed!
```

## Lưu ý về `dependency_overrides` trong pubspec.yaml

`path_provider_foundation` bản 2.5.0+/2.6.0 phụ thuộc gói `objective_c`, mà hook build
native-assets của gói này hiện đang lỗi trên Windows (`flutter test`/`dart compile kernel`
báo `'C:\Users\...' is not recognized...` hoặc lỗi biên dịch `Undefined name 'OS'` tuỳ phiên
bản `hooks`/`code_assets` được resolve) — đây là lỗi hệ sinh thái/tooling, không phải lỗi
code của app. Đã pin về `2.5.1` (bản trước khi thêm dependency này) để né. Gỡ override này khi
upstream (flutter/packages) sửa xong.

## Chạy

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000   # 10.0.2.2 = localhost của máy host khi chạy Android emulator
```

Nếu cần thêm lại các nền tảng đã bỏ (Windows/Linux/macOS desktop):
```bash
flutter create . --platforms=windows,linux,macos
```

## Cấu trúc

```
lib/
├── core/            api_client (Dio + refresh interceptor), secure_token_store, theme, providers (Riverpod)
├── features/
│   ├── auth/         OTP request/verify, auth gate
│   ├── report/       Báo tin (form, chụp ảnh giữ EXIF GPS, fallback device GPS)
│   ├── emergency/     Cấp cứu (SOS) — luồng tối giản, ưu tiên tốc độ
│   └── status/       Tin của tôi + chi tiết trạng thái
└── shared/widgets/    StatusBadge dùng chung
```
