# Changelog

## Giai đoạn 2 (bắt đầu) — Kênh tình báo mở
- **"Tin nhanh (tham khảo)"** — màn hình/tab mới trên cả `mobile-app-officer` và `dashboard-web`, đọc từ bảng `social_media_signals` đã có sẵn từ trước. Tách biệt hoàn toàn khỏi luồng tin dân báo: không có nhãn trạng thái, không có nút xác nhận/duyệt, chỉ có nhãn nguồn (Báo chí / MXH — chưa xác thực) với màu sắc riêng (tím/xám, không trùng statusColor/urgencyColor) — CLAUDE.md nguyên tắc #1/#2.
- API mới (đọc-only): `GET /officer/signals`, `GET /officer/signals/:id` — cùng cơ chế district-scoping như `/officer/reports` (officer thường chỉ thấy tín hiệu thuộc địa bàn được phân công, senior_officer/admin thấy tất cả).
- Seed dữ liệu mẫu (`seed-signals.ts`) mô phỏng kết quả crawler báo chí/MXH — **chưa có crawler thật nào chạy**, đúng theo CLAUDE.md nguyên tắc #4 (không crawl live khi demo/thi).
- Tiện thể sửa 1 bug tiềm ẩn: `setState(() => _future = _load())` — cú pháp arrow-function khiến callback bị coi là "trả về Future", Flutter framework báo lỗi runtime khi bấm filter chip. Có ở cả `mobile-app-officer` (2 màn) và `mobile-app-citizen` (1 màn), sửa thành block-body.

## 1.2 (đang phát triển)
- Thêm `dashboard-web/` (Flutter Web) — trang tổng quan cho `admin`/`senior_officer` chạy trên máy tính trung tâm: KPI tổng số tin, thời gian phản hồi TB theo địa bàn/cán bộ, xu hướng theo ngày, hàng đợi yêu cầu trích xuất camera.
- API mới: `GET /admin/dashboard/overview`, `/response-time-by-district`, `/response-time-by-officer`, `/volume-trend`, `/camera-queue`.
- Seed thêm 1 tài khoản demo role `admin`.
- **Seed:** mọi xã/phường trong số 102 xã/phường đã seed nay đều có ít nhất 1 cán bộ demo được phân công (trước đây chỉ 4/102) — để tin báo ở bất kỳ xã/phường nào cũng geo-matching ra được cán bộ nhận thông báo, không chỉ 4 địa bàn demo ban đầu (`seed-officers.ts` → `seedOfficersForAllDistricts`).
- **Tab "Tin báo" trên dashboard** — danh sách tin báo mới (lọc trạng thái/khẩn cấp) + chi tiết + duyệt trạng thái (Đúng sự thật/Đang xác minh/Tin sai) + gợi ý camera gần hiện trường, ngay trên `dashboard-web`. Tái dùng nguyên endpoint `/officer/reports*` đã có (không cần API mới — 2 role này vốn đã được phép truy cập không giới hạn địa bàn). Tự làm mới danh sách mỗi 20s để tin mới hiện lên không cần bấm F5.

## 1.1
- Thêm module camera an ninh: tự động khoanh vùng camera gần tọa độ tin báo (PostGIS `ST_DWithin`), cán bộ tạo yêu cầu trích xuất gửi đơn vị quản lý — hệ thống không kết nối/xem/tải/phân tích video (CLAUDE.md nguyên tắc #8).
- Bảng mới: `cameras`, `camera_extraction_requests`.
- API mới: `GET /officer/reports/:id/nearby-cameras`, `POST /officer/reports/:id/camera-extraction-requests`, `GET /officer/reports/:id/camera-extraction-requests`.

## 1.0 — Giai đoạn 1 (core)
- Auth: OTP hash + blind-index SĐT, JWT RS256 + refresh rotate, rate-limit theo SECURITY.md.
- Báo tin thường (giữ EXIF GPS) + Cấp cứu (luồng tối giản).
- Geo-matching PostGIS thật với 102 xã/phường Đắk Lắk (`data/raw/Daklak.geojson`) + gán cán bộ.
- App cán bộ: danh sách ưu tiên, chi tiết, xác minh trạng thái, chặn chéo địa bàn, ẩn danh tính + audit log.
- 2 app Flutter (citizen + officer) — đã xác nhận `flutter analyze`/`flutter test` pass.
