# Kiến trúc hệ thống — Báo Tin

## Sơ đồ luồng tổng quan

```
[App người dân] ──────┐
  - Báo tin thường     │
  - Nút cấp cứu (SOS)  │
                       ▼
[Crawler MXH/báo]  ──► [Backend API] ──► [Module Geo-matching] ──► [App/kênh cán bộ]
  (Giai đoạn 2)             │                                            │
                            │                                    Xác nhận trạng thái:
                            ▼                                    Đúng / Đang xác minh / Sai
                  ┌─────────┴─────────┐                                  │
                  ▼                   ▼                                  ▼
         PostgreSQL + PostGIS   Object Storage              API liên kết → Phần mềm
         (dữ liệu chính)        (ảnh, file)                   quản lý tin bài (hệ thống cũ)
```

## Các module backend chính

### 1. `api/` — Tầng giao tiếp
- Endpoint nhận tin báo từ app dân (ảnh, GPS, mô tả, loại)
- Endpoint cho app cán bộ (lấy danh sách tin theo địa bàn, cập nhật trạng thái)
- Endpoint liên kết sang phần mềm tin bài chính (webhook/API khi tin được xác nhận)

### 2. `geo/` — Geo-matching
- Input: tọa độ GPS (lat/lng) từ ảnh hoặc vị trí thiết bị
- Xử lý: dùng PostGIS `ST_Contains`/`ST_Within` để xác định tin thuộc địa bàn (phường/xã) nào, dựa trên bảng ranh giới hành chính (geojson polygon)
- Output: `địa_bàn_id` → tra bảng phân công → `cán_bộ_phụ_trách_id`
- **Yêu cầu dữ liệu nền:** bảng ranh giới hành chính (geojson) + bảng phân công cán bộ theo địa bàn — phải có trước khi module này chạy được

### 3. `crawler/` — Kênh tình báo mở (Giai đoạn 2, module độc lập)
- Thu thập theo nguồn đã cấu hình (danh sách URL/RSS + tần suất riêng từng nguồn)
- Ưu tiên nguồn có RSS chính thức (báo chí) trước
- Lọc từ khóa địa danh Đắk Lắk + loại vụ việc an ninh trật tự
- Tóm tắt bằng AI (1-2 câu/tin)
- Gộp tin trùng về cùng sự việc (dedup theo similarity)
- Gắn nhãn `source_type` + `trust_level` — KHÔNG BAO GIỜ trộn với dữ liệu tin dân báo trong cùng 1 view/API response

### 4. `notifications/` — Gửi thông báo
- Push notification nội bộ (ưu tiên)
- Fallback SMS/Zalo OA nếu cán bộ không mở app kịp thời (dùng cho tin mức khẩn cấp)
- Lưu timestamp gửi + timestamp cán bộ xác nhận → phục vụ tính SLA sau này

### 5. `services/` — Nghiệp vụ
- Tính mức ưu tiên tin (khẩn cấp/bình thường) dựa trên loại vụ việc
- Xử lý trạng thái vòng đời tin (mới → đang xác minh → đóng)
- Liên kết ngược sang phần mềm tin bài chính khi tin được xác nhận "Đúng sự thật"

### 6. `models/` — Định nghĩa dữ liệu
Xem chi tiết schema ở `DATABASE_SCHEMA.md`

## 2 app di động riêng biệt — vì sao tách
- **`mobile-app-citizen`**: giao diện tối giản, ưu tiên tốc độ (nút SOS, báo tin nhanh), không cần thấy dữ liệu nghiệp vụ nội bộ.
- **`mobile-app-officer`**: giao diện nghiệp vụ, hiển thị danh sách tin theo địa bàn, bản đồ, thao tác xác minh — không cần các tính năng cộng đồng/tiện ích của app dân.
- Cả 2 dùng chung 1 backend, phân quyền theo role qua auth token.

## Nguyên tắc lưu trữ dữ liệu
- **PostgreSQL + PostGIS**: dữ liệu có cấu trúc, quan hệ, địa lý — nguồn dữ liệu chính, cần backup định kỳ.
- **Object storage (MinIO)**: chỉ lưu ảnh/file, không lưu blob trong DB — DB chỉ giữ đường dẫn.
- **Chính sách lưu nóng/lạnh**: dữ liệu tin MXH "Tin sai" có thể đặt thời hạn tự xóa (ví dụ 30-60 ngày) để tránh phình dữ liệu rác.
