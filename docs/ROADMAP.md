# Roadmap phát triển — Báo Tin

## Giai đoạn 1 — Core (bắt buộc trước tiên)
Mục tiêu: chạy được luồng chính đầu-cuối, demo được.

- [ ] Schema database (users, officers, districts, reports, attachments)
- [ ] Nạp dữ liệu ranh giới hành chính (geojson) cho districts — **cần chuẩn bị dữ liệu, không chỉ code**
- [ ] Nạp danh sách cán bộ + phân công địa bàn
- [ ] API báo tin thường (ảnh + GPS EXIF + mô tả)
- [ ] API báo tin khẩn cấp (nút SOS, tối giản luồng)
- [ ] Module geo-matching (PostGIS)
- [ ] Notification cơ bản (push, fallback SMS)
- [ ] App người dân: màn hình Báo tin + Cấp cứu + xem trạng thái
- [ ] App cán bộ: danh sách tin theo địa bàn + xác nhận trạng thái
- [ ] Đo `response_time_seconds` cho mỗi tin

## v1.1 — Module camera an ninh (bổ sung sau Giai đoạn 1)
Gợi ý tự động camera gần hiện trường để cán bộ chủ động liên hệ đơn vị quản lý xin trích xuất — hệ thống không bao giờ tự xem/tải/phân tích video (CLAUDE.md nguyên tắc #8).

- [ ] Bảng `cameras` (vị trí, đơn vị quản lý + liên hệ) + `camera_extraction_requests`
- [ ] API tự động khoanh vùng camera gần tọa độ tin báo (bán kính cấu hình được, PostGIS `ST_DWithin`)
- [ ] API tạo/xem yêu cầu trích xuất (chỉ metadata hành chính, không có bước xử lý video)
- [ ] App cán bộ: hiển thị camera gợi ý ngay trong màn chi tiết tin (tự động, không cần bấm tìm kiếm) + form tạo yêu cầu trích xuất
- [ ] Seed dữ liệu camera demo (rõ ràng là dữ liệu mẫu, giống cách seed cán bộ demo)

## v1.2 — Dashboard trung tâm điều hành (làm sớm hạng mục Giai đoạn 4)
Trang tổng quan cho `admin`/`senior_officer`, chạy trên máy tính (web), không dành cho `officer` thường.

- [ ] API tổng hợp: tổng số tin, đếm theo status/urgency, thời gian phản hồi TB theo địa bàn/cán bộ, xu hướng theo ngày, hàng đợi yêu cầu trích xuất camera
- [ ] `dashboard-web/` (Flutter Web) — KPI card + biểu đồ, lọc theo khoảng ngày + địa bàn
- [ ] Seed 1 tài khoản demo role `admin` để đăng nhập thử

## Giai đoạn 2 — Kênh tình báo mở
Module độc lập, không block giai đoạn 1.

- [ ] Bảng `social_media_signals` (tách biệt hoàn toàn khỏi `reports`)
- [ ] Crawler nguồn báo chí (RSS) trước
- [ ] Crawler MXH (nguồn public hợp lệ) sau
- [ ] Cấu hình tần suất riêng theo từng nguồn
- [ ] Lọc từ khóa địa danh + loại vụ việc
- [ ] AI tóm tắt 1-2 câu
- [ ] Gộp tin trùng (dedup theo similarity)
- [ ] UI riêng "Tin nhanh (tham khảo)" — tách biệt rõ khỏi tin đã xác thực
- [ ] Seed data mẫu để demo (không crawl live khi thi)

## Giai đoạn 3 — Trải nghiệm & liên kết
- [ ] Bản đồ cảnh báo khu vực cho người dân (tổng hợp, không chi tiết nhạy cảm)
- [ ] Danh bạ khẩn cấp tự động theo vị trí
- [ ] Lịch sử báo tin cá nhân đầy đủ
- [ ] Chính sách ẩn danh với đối tượng vi phạm
- [ ] API liên kết ngược sang phần mềm quản lý tin bài chính (`official_case_links`)
- [ ] Đồng bộ danh mục địa bàn giữa 2 hệ thống

## Giai đoạn 4 — Nâng cao (demo bằng mock nếu chưa kịp làm thật)
- [ ] Quét NFC CCCD — mock UI trước, tích hợp thật qua VNeID/SDK sau
- [ ] Tính "độ nóng" tin MXH (cần dữ liệu chạy vài tuần)
- [ ] Đối chiếu tin MXH với hồ sơ nội bộ đã có (liên kết chéo)
- [ ] Gợi ý "gửi tố cáo chính thức qua VNeID" cho tin nghiêm trọng
- [x] ~~Dashboard KPI: thời gian phản hồi trung bình theo địa bàn/cán bộ~~ — làm sớm ở v1.2 (xem mục v1.2 phía trên)

## Ưu tiên khi thời gian hạn chế (thi đấu)
Nếu không đủ thời gian làm hết Giai đoạn 1, thứ tự tối thiểu để demo được câu chuyện trọn vẹn:
1. Báo tin thường (ảnh + GPS + mô tả) — có thể mock geo-matching bằng dữ liệu cứng nếu chưa kịp tích hợp PostGIS thật
2. Nút cấp cứu
3. App cán bộ xem tin + xác nhận trạng thái
4. 1 vài tin mẫu trong "Tin nhanh (tham khảo)" để minh họa Giai đoạn 2 dù chưa code crawler thật
