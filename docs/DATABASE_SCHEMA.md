# Database Schema — Báo Tin (PostgreSQL + PostGIS)

> Đây là bản phác thảo để bắt đầu code. Điều chỉnh kiểu dữ liệu/tên cột theo stack cụ thể khi triển khai.

## Bật extension cần thiết
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## 1. `users` — Tài khoản người dân
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    verified_at TIMESTAMP,           -- thời điểm xác thực OTP thành công
    is_anonymous_public BOOLEAN DEFAULT true, -- ẩn danh với đối tượng vi phạm
    created_at TIMESTAMP DEFAULT now()
);
```

## 2. `officers` — Cán bộ phụ trách
```sql
CREATE TABLE officers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(15),
    unit_name VARCHAR(255),           -- ví dụ: Công an phường X
    district_id UUID REFERENCES districts(id),
    created_at TIMESTAMP DEFAULT now()
);
```

## 3. `districts` — Địa bàn hành chính (dữ liệu nền bắt buộc)
```sql
CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,        -- ví dụ: Phường Tân Lợi
    parent_name VARCHAR(255),          -- ví dụ: TP. Buôn Ma Thuột
    boundary GEOMETRY(Polygon, 4326),  -- ranh giới địa lý (geojson import)
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_districts_boundary ON districts USING GIST (boundary);
```
**Lưu ý:** bảng này cần được nạp dữ liệu geojson ranh giới hành chính thật trước khi module geo-matching hoạt động. Đây là việc phải chuẩn bị song song, không phải việc code thuần túy.

## 4. `officer_district_assignments` — Phân công cán bộ theo địa bàn
```sql
CREATE TABLE officer_district_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    officer_id UUID REFERENCES officers(id),
    district_id UUID REFERENCES districts(id),
    is_active BOOLEAN DEFAULT true
);
```

## 5. `reports` — Tin báo từ dân (bảng trung tâm)
```sql
CREATE TYPE report_source AS ENUM ('citizen', 'social_media');
CREATE TYPE report_urgency AS ENUM ('emergency', 'normal');
CREATE TYPE report_status AS ENUM ('pending', 'verifying', 'confirmed_true', 'confirmed_false');

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source report_source NOT NULL DEFAULT 'citizen',
    user_id UUID REFERENCES users(id),          -- null nếu source = social_media
    category VARCHAR(100),                       -- loại vụ việc: tai nạn/cháy nổ/trộm cắp...
    urgency report_urgency DEFAULT 'normal',
    description TEXT,
    voice_note_url TEXT,                         -- nếu ghi âm thay vì gõ chữ
    location GEOMETRY(Point, 4326),               -- tọa độ GPS
    location_source VARCHAR(50),                 -- 'exif' | 'device_gps' | 'manual_pin'
    district_id UUID REFERENCES districts(id),   -- kết quả geo-matching
    assigned_officer_id UUID REFERENCES officers(id),
    status report_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now(),
    verified_at TIMESTAMP,                       -- lúc cán bộ xác nhận trạng thái
    response_time_seconds INT                    -- tính tự động: verified_at - created_at
);
CREATE INDEX idx_reports_location ON reports USING GIST (location);
CREATE INDEX idx_reports_district ON reports (district_id);
```

## 6. `report_attachments` — Ảnh/file đính kèm tin báo
```sql
CREATE TABLE report_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id),
    file_url TEXT NOT NULL,           -- path trên object storage (MinIO)
    file_type VARCHAR(50),            -- image/audio/...
    exif_gps_lat DOUBLE PRECISION,    -- lưu riêng để đối chiếu/debug
    exif_gps_lng DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT now()
);
```

## 7. `social_media_signals` — Tin từ kênh tình báo mở (TÁCH RIÊNG khỏi `reports`)
```sql
CREATE TYPE trust_level AS ENUM ('verified_press', 'unverified_social');

CREATE TABLE social_media_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name VARCHAR(255),          -- tên trang/nguồn
    source_url TEXT,
    trust_level trust_level NOT NULL,
    summary TEXT,                      -- tóm tắt AI 1-2 câu
    raw_snippet TEXT,                  -- đoạn gốc rút gọn (không lưu toàn văn)
    district_id UUID REFERENCES districts(id),
    detected_category VARCHAR(100),
    published_at TIMESTAMP,
    crawled_at TIMESTAMP DEFAULT now(),
    duplicate_of UUID REFERENCES social_media_signals(id) -- nếu bị nhận diện trùng
);
```
**Quan trọng:** bảng này KHÔNG có cột `assigned_officer_id` hay `status` xác minh giống `reports` — vì tin loại này chỉ mang tính tham khảo, không đi qua workflow xử lý chính thức (theo nguyên tắc đã chốt trong CLAUDE.md).

## 8. `report_status_history` — Lịch sử thay đổi trạng thái (audit trail)
```sql
CREATE TABLE report_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id),
    old_status report_status,
    new_status report_status,
    changed_by UUID REFERENCES officers(id),
    changed_at TIMESTAMP DEFAULT now()
);
```

## 9. `official_case_links` — Liên kết sang phần mềm tin bài chính
```sql
CREATE TABLE official_case_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id),
    external_case_id VARCHAR(255),     -- ID hồ sơ bên phần mềm tin bài chính
    linked_at TIMESTAMP DEFAULT now()
);
```

## 10. `cameras` — Camera an ninh công cộng/tư nhân đã đăng ký (v1.1)
```sql
CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,               -- ví dụ: "Camera an ninh ngã tư Lê Duẩn"
    location GEOMETRY(Point, 4326) NOT NULL,
    managing_unit_name VARCHAR(255),          -- đơn vị quản lý camera (công an phường, doanh nghiệp...)
    managing_unit_contact VARCHAR(255),       -- SĐT/email liên hệ để gửi yêu cầu trích xuất thủ công
    district_id UUID REFERENCES districts(id),
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_cameras_location ON cameras USING GIST (location);
```
**Quan trọng (CLAUDE.md nguyên tắc #8):** bảng này CHỈ lưu vị trí + thông tin liên hệ đơn vị quản lý — không có cột lưu video/stream, không có cột kết quả nhận diện. Hệ thống Báo Tin không bao giờ tự kết nối/xem/tải video từ các camera này.

## 11. `camera_extraction_requests` — Yêu cầu trích xuất đoạn ghi hình (v1.1)
```sql
CREATE TYPE extraction_request_status AS ENUM ('pending', 'sent', 'fulfilled', 'rejected');

CREATE TABLE camera_extraction_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id),
    camera_id UUID REFERENCES cameras(id),
    requested_by UUID REFERENCES officers(id),  -- cán bộ tạo yêu cầu
    time_range_start TIMESTAMP NOT NULL,
    time_range_end TIMESTAMP NOT NULL,
    note TEXT,
    status extraction_request_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now()
);
```
**Quan trọng:** đây là bản ghi **yêu cầu**, không phải kết quả — không có cột lưu file video trả về. Đơn vị quản lý camera xử lý trích xuất thủ công ngoài hệ thống (qua `managing_unit_contact`); `status` chỉ theo dõi tiến độ hành chính của yêu cầu (đã gửi/đã xử lý/từ chối), không đại diện cho việc phân tích nội dung video.

## Ghi chú triển khai
- Toàn bộ bảng dùng UUID làm khóa chính để dễ đồng bộ/liên kết giữa các hệ thống sau này.
- Cột `response_time_seconds` nên tính bằng trigger hoặc tính ở tầng application khi update status — dùng để dựng KPI SLA ở giai đoạn 4.
- Cân nhắc partition bảng `social_media_signals` theo tháng nếu khối lượng lớn dần theo thời gian.
