# mobile-app-officer

Flutter app cho cán bộ phụ trách địa bàn — danh sách tin theo địa bàn, chi tiết, xác minh trạng thái.

## Trạng thái

Đã scaffold `android/`, `ios/`, `web/` (bỏ `windows/`, `linux/`, `macos/` — không cần cho scope
hiện tại). Không cần quyền camera/vị trí (app này không chụp ảnh hay lấy GPS thiết bị — chỉ hiển
thị dữ liệu do app người dân gửi lên).

Đã xác nhận (trên máy dev có Flutter 3.44.6):
```
flutter analyze   → No issues found!
flutter test      → All tests passed!
```

`pubspec.yaml` có cùng `dependency_overrides: path_provider_foundation: 2.5.1` như
`mobile-app-citizen` — xem giải thích ở README của app đó (né lỗi native-assets `objective_c`
trên Windows, không liên quan tới code app).

## Chạy

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Đăng nhập bằng SĐT của 1 trong các cán bộ demo đã seed (xem `backend/prisma/seed/seed-officers.ts`),
ví dụ `0900000001`.

## Cấu trúc

```
lib/
├── core/               api_client, secure_token_store, theme, providers (Riverpod)
├── features/
│   ├── auth/            Đăng nhập cán bộ (OTP qua /auth/officer/login), auth gate
│   ├── reports_list/    Danh sách tin theo địa bàn (lọc trạng thái/khẩn cấp)
│   ├── report_detail/   Chi tiết tin + hành động xác minh trạng thái
│   └── cameras/         (v1.1) Gợi ý camera gần hiện trường tự động + tạo yêu cầu trích xuất —
│                        chỉ hiển thị vị trí/liên hệ đơn vị quản lý, không xem/tải video
└── shared/widgets/       StatusBadge, UrgencyBadge dùng chung
```
