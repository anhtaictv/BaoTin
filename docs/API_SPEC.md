# API Spec sơ bộ — Báo Tin

> Phác thảo endpoint chính để bắt đầu code Giai đoạn 1. Điều chỉnh format theo framework cụ thể (REST/GraphQL).

## Auth
- `POST /auth/otp/request` — gửi OTP theo số điện thoại
- `POST /auth/otp/verify` — xác thực OTP, trả về token
- `POST /auth/officer/login` — đăng nhập cán bộ (tài khoản do quản trị cấp)

## App người dân

### Báo tin
- `POST /reports`
  - Body: `category`, `description`, `voice_note` (optional), `location {lat, lng, source}`, `attachments[]`
  - Xử lý: lưu report → chạy geo-matching → xác định officer → tạo notification
  - Response: `report_id`, `status: 'pending'`

- `POST /reports/emergency`
  - Body: `emergency_type`, `location {lat, lng}`
  - Xử lý: giống trên nhưng `urgency = 'emergency'`, bỏ qua các bước không cần thiết để tối ưu tốc độ, ưu tiên gửi notification ngay
  - Response tối giản, ưu tiên độ trễ thấp nhất

- `GET /reports/mine` — lịch sử báo tin của user hiện tại
- `GET /reports/:id/status` — trạng thái tin cụ thể

### Tiện ích
- `GET /emergency-contacts?lat=&lng=` — danh bạ khẩn cấp theo vị trí (Giai đoạn 3)
- `GET /area-alerts?lat=&lng=` — bản đồ cảnh báo khu vực (Giai đoạn 3, dữ liệu tổng hợp không chi tiết nhạy cảm)

## App cán bộ

- `GET /officer/reports?district_id=&status=&urgency=` — danh sách tin theo địa bàn phụ trách, sắp theo ưu tiên
- `GET /officer/reports/:id` — chi tiết 1 tin (ảnh, vị trí, mô tả)
- `PATCH /officer/reports/:id/status`
  - Body: `{ status: 'confirmed_true' | 'verifying' | 'confirmed_false', note }`
  - Xử lý: cập nhật `reports.status`, ghi `report_status_history`, tính `response_time_seconds`
  - Nếu `confirmed_true` và mức độ nghiêm trọng → gọi `services/official_case_link` để tạo liên kết sang phần mềm tin bài chính

### Module camera an ninh (v1.1)
- `GET /officer/reports/:id/nearby-cameras?radius_m=500`
  - **Tự động khoanh vùng** — không cần cán bộ tự tìm kiếm: khi mở chi tiết tin, hệ thống tự truy vấn `cameras` trong bán kính `radius_m` (mặc định 500m) quanh tọa độ tin báo và trả về ngay danh sách gợi ý (tên camera, khoảng cách, đơn vị quản lý + liên hệ)
  - Chỉ trả về vị trí/liên hệ camera — **không truy cập, không xem, không tải video** (CLAUDE.md nguyên tắc #8)
- `POST /officer/reports/:id/camera-extraction-requests`
  - Body: `{ cameraId, timeRangeStart, timeRangeEnd, note }`
  - Xử lý: tạo bản ghi yêu cầu trích xuất (hành chính, không kèm file) — đơn vị quản lý camera xử lý thủ công ngoài hệ thống qua `managing_unit_contact`
- `GET /officer/reports/:id/camera-extraction-requests` — danh sách yêu cầu đã tạo cho tin báo này + trạng thái xử lý

## Dashboard trung tâm điều hành (v1.2 — chỉ `admin`/`senior_officer`)
Làm sớm hạng mục "Dashboard KPI" vốn dự kiến ở Giai đoạn 4. Chạy trên `dashboard-web/` (Flutter Web), không dành cho `officer` thường.

- `GET /admin/dashboard/overview?district_id=&days=` — tổng số tin, đếm theo status/urgency, thời gian phản hồi trung bình
- `GET /admin/dashboard/response-time-by-district?days=` — thời gian phản hồi TB + số tin theo từng địa bàn
- `GET /admin/dashboard/response-time-by-officer?days=` — thời gian phản hồi TB theo cán bộ (tên đã giải mã, không trả về SĐT thô)
- `GET /admin/dashboard/volume-trend?days=` — số tin theo từng ngày (mặc định 30 ngày)
- `GET /admin/dashboard/camera-queue` — số lượng yêu cầu trích xuất camera theo trạng thái (pending/sent/fulfilled/rejected)
- `GET /admin/dashboard/districts` — danh sách toàn bộ địa bàn (id + tên) để hiển thị dropdown lọc

## Liên kết hệ thống tin bài chính
- `POST /integrations/official-case` (internal, gọi bởi service khi tin được confirmed_true)
  - Body: toàn bộ dữ liệu report đã chuẩn hóa
  - Gửi đến API của phần mềm quản lý tin bài hiện có → nhận `external_case_id` → lưu vào `official_case_links`

## Kênh tình báo mở (Giai đoạn 2 — module riêng, không lộ ra app cán bộ chính)
- `GET /osint/signals?district_id=&trust_level=` — lấy tín hiệu MXH/báo chí theo địa bàn (hiển thị tách biệt UI)
- Internal cron job: `crawler` chạy theo tần suất cấu hình từng nguồn, ghi vào `social_media_signals`

## Response chuẩn (đề xuất)
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

## Bảo mật cần lưu ý khi code
- Toàn bộ endpoint `/officer/*` yêu cầu role = officer, kiểm tra `district_id` khớp với phân công thực tế (không cho xem tin ngoài địa bàn phụ trách trừ vai trò cấp trên).
- Endpoint `/reports/emergency` cần rate-limit hợp lý để tránh spam nhưng KHÔNG được làm chậm response — ưu tiên tốc độ hơn validate phức tạp.
- Ảnh upload validate định dạng + kích thước trước khi lưu MinIO, virus scan nếu hạ tầng cho phép.
