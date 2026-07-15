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
- [ ] Bảng `cameras` + seed dữ liệu mẫu (vị trí camera công cộng/hợp tác quanh khu vực demo)
- [ ] Truy vấn camera trong bán kính quanh điểm báo tin (PostGIS `ST_DWithin`)
- [ ] Hiển thị camera gần đó trên bản đồ khi cán bộ xem chi tiết tin
- [ ] Luồng tạo phiếu yêu cầu trích xuất camera (`camera_footage_requests`) — chỉ tạo yêu cầu, không tự động xử lý video

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
- [ ] Dashboard KPI: thời gian phản hồi trung bình theo địa bàn/cán bộ

## Ưu tiên khi thời gian hạn chế (thi đấu)
Nếu không đủ thời gian làm hết Giai đoạn 1, thứ tự tối thiểu để demo được câu chuyện trọn vẹn:
1. Báo tin thường (ảnh + GPS + mô tả) — có thể mock geo-matching bằng dữ liệu cứng nếu chưa kịp tích hợp PostGIS thật
2. Nút cấp cứu
3. App cán bộ xem tin + xác nhận trạng thái
4. 1 vài tin mẫu trong "Tin nhanh (tham khảo)" để minh họa Giai đoạn 2 dù chưa code crawler thật
