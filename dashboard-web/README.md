# dashboard-web

Flutter Web — dashboard trung tâm điều hành cho `admin`/`senior_officer` (v1.2). Không dành
cho tài khoản `officer` thường (backend trả 403).

## Trạng thái

Đã scaffold platform `web/`. Đã xác nhận (Flutter 3.44.6):
```
flutter analyze   → No issues found!
flutter test      → All tests passed! (3 test: auth-gate boot, render toàn bộ
                     DashboardScreen thật với 4 biểu đồ fl_chart + KPI cards, render tab
                     Tin báo — chọn 1 tin và thấy chi tiết + nút duyệt trạng thái)
```

Cùng `dependency_overrides: path_provider_foundation: 2.5.1` như 2 app mobile — xem giải
thích ở `mobile-app-citizen/README.md` (né lỗi native-assets `objective_c` trên Windows).

**Lưu ý font:** `GoogleFonts.config.allowRuntimeFetching = false` được set trong
`lib/core/theme.dart` — `google_fonts` mặc định tải font qua `fonts.gstatic.com` lúc chạy,
không phù hợp cho công cụ nội bộ (và crash thẳng nếu không có mạng). Tắt fetch runtime thì
tự rơi về font hệ thống thay vì gọi mạng.

## Thiết kế

Design system tạo bằng skill `ui-ux-pro-max` đã cài (`.claude/skills/ui-ux-pro-max`):
- `--design-system "admin dashboard analytics saas internal tool" --density 8 --variance 2 --motion 2`
- `--domain style "dense dashboard data table admin professional"` → **Data-Dense Dashboard**
  (lưới 12 cột, spacing 8-12px, chữ 12-14px, mật độ thông tin tối đa)
- Màu: primary `#1E40AF`, accent `#D97706`, nền `#F8FAFC` (light) — xem `lib/core/theme.dart`
- Font: Fira Sans (chữ) + Fira Code (số liệu KPI, tabular figures chống giật cột)
- Biểu đồ theo skill `dataviz`: bar chart cho so sánh (thời gian phản hồi theo địa bàn/cán
  bộ, 1 màu duy nhất + nhãn giá trị trực tiếp thay vì bảng màu tùy tiện), line chart cho xu
  hướng theo ngày, thanh ngang xếp chồng cho phân bổ trạng thái (tái dùng đúng
  `statusColor()`/`statusLabel()` từ `mobile-app-officer` để 3 app không lệch màu), stat tile
  cho KPI đơn lẻ và hàng đợi camera (không vẽ chart cho 1 con số)
- Mỗi biểu đồ có trạng thái loading/error/rỗng riêng (không có 1 spinner chặn toàn trang) —
  xem `lib/features/dashboard/dashboard_providers.dart`
- `adaptive-navigation`: `NavigationRail` bên trái (2 tab: Tổng quan / Tin báo) — màn hình
  lớn ưu tiên sidebar hơn tab ngang, đúng theo dữ liệu `ui-ux-pro-max`

## Tab "Tin báo" — xem/duyệt tin báo trực tiếp trên dashboard

Không cần API mới: tái dùng nguyên `/officer/reports*` — 2 role `admin`/`senior_officer`
vốn đã được `districtScope.ts` cho phép truy cập không giới hạn địa bàn. Bố cục master-detail
(danh sách trái, chi tiết phải ở màn ≥900px), danh sách tự làm mới mỗi 20s (poll, chưa có
websocket) để tin mới từ dân gửi lên hiện ra không cần bấm F5. Chi tiết gồm ảnh, vị trí, danh
tính (theo đúng quy tắc ẩn danh), gợi ý camera gần hiện trường, và nút duyệt trạng thái
(Đúng sự thật/Đang xác minh/Tin sai — không có gợi ý AI, giữ đúng nguyên tắc human-in-the-loop).

## Chạy

```bash
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000
```

Build production: `flutter build web`.

Xem giao diện không cần backend: `flutter run -d chrome -t lib/main_demo.dart` (dữ liệu giả
lập, kể cả tin báo mới "xuất hiện" dần trong tab Tin báo mỗi 15s để minh hoạ auto-refresh).

Đăng nhập bằng SĐT tài khoản admin demo đã seed: `0900000099` (xem
`backend/prisma/seed/seed-officers.ts`).

## Cấu trúc

```
lib/
├── core/                 api_client, secure_token_store, theme (design system riêng), providers
├── main_demo.dart         Entry point demo — dữ liệu giả lập, không cần backend (xem trên)
├── features/
│   ├── auth/              Đăng nhập qua /auth/officer/login (dùng chung với officer app)
│   ├── cameras/            Gợi ý camera gần hiện trường + tạo yêu cầu trích xuất (port từ officer app)
│   ├── reports/
│   │   ├── reports_repository.dart    gọi /officer/reports*
│   │   ├── reports_providers.dart     poll 20s + filters + selected report state
│   │   ├── reports_tab.dart           layout master-detail
│   │   └── widgets/                   report_list_pane, report_detail_pane, status_update_action
│   └── dashboard/
│       ├── dashboard_filters.dart     state lọc dùng chung (khoảng ngày + địa bàn)
│       ├── dashboard_providers.dart   1 FutureProvider độc lập / endpoint — 1 provider lỗi
│       │                              không chặn các provider khác
│       ├── dashboard_repository.dart  gọi 6 endpoint /admin/dashboard/*
│       ├── dashboard_screen.dart      shell: NavigationRail + 2 tab (Tổng quan/Tin báo)
│       ├── dashboard_overview_tab.dart lưới KPI + lưới biểu đồ responsive (2 cột ≥900px)
│       └── widgets/                   kpi_card, response_time_bar_chart, volume_trend_line_chart,
│                                      status_breakdown_chart, camera_queue_tiles, filter_bar
```
