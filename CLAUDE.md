# Báo Tin — Hệ thống tiếp nhận & xử lý tin báo an ninh trật tự

## Bối cảnh dự án
"Báo Tin" là phần mềm **độc lập**, không phải module của phần mềm quản lý tin bài hiện có (dù có liên kết API 2 chiều). Mục đích: kênh **phản ứng nhanh cấp cơ sở** — tiếp nhận tin từ dân + tín hiệu mạng xã hội, định tuyến tức thời đến đúng cán bộ phụ trách địa bàn, rút ngắn thời gian xác minh so với các kênh hành chính thông thường (kể cả VNeID).

**Định vị:** bổ trợ VNeID, không thay thế. VNeID = tố cáo chính thức có giá trị pháp lý. Báo Tin = phản ứng tức thời, tại chỗ.

## Nguyên tắc thiết kế bắt buộc (không được vi phạm khi code)
1. **Tin từ MXH/báo chí KHÔNG BAO GIỜ được hiển thị chung hoặc gắn nhãn giống tin đã xác thực.** Luôn tách UI, luôn gắn nhãn nguồn + độ tin cậy rõ ràng.
2. **Không có workflow nào tự động biến tin MXH thành hồ sơ chính thức.** Chỉ tin dân báo (có GPS + định danh SĐT) hoặc đã được cán bộ xác nhận "Đúng sự thật" mới được đẩy sang hệ thống tin bài chính qua API.
3. **Human-in-the-loop bắt buộc** ở bước xác minh: mọi tin đều cần cán bộ phụ trách địa bàn chọn trạng thái (Đúng sự thật / Đang xác minh / Tin sai) — không có bước AI tự kết luận đúng/sai.
4. **Không crawl live khi demo** — module crawler dùng dữ liệu mẫu (seed data) trong giai đoạn thi/demo.
5. **Không tự viết code đọc chip NFC CCCD.** Giai đoạn đầu chỉ mock UI; tích hợp thật (nếu làm sau) phải qua VNeID/SDK chính thức của Bộ Công an, không tự parse chip.
6. **Giữ nguyên vẹn EXIF GPS của ảnh** — người dân phải upload trực tiếp trong app (chụp hoặc chọn từ thư viện), không nhận ảnh qua kênh trung gian (Zalo/Messenger) vì các nền tảng đó thường strip EXIF.
7. **Bảo mật là yêu cầu từ đầu, không phải làm sau.** Xem `docs/SECURITY.md` trước khi viết bất kỳ endpoint auth/lưu trữ dữ liệu định danh nào. Không tự ý bỏ qua checklist bảo mật tối thiểu dù đang trong giai đoạn demo/thi.

## Tech stack đã chốt
- **Database:** PostgreSQL + PostGIS (dữ liệu quan hệ + địa lý)
- **Object storage:** MinIO (on-premise) cho ảnh/file đính kèm — chỉ lưu path trong Postgres, không lưu blob trong DB
- **Search/MXH khối lượng lớn (giai đoạn sau):** Elasticsearch — chưa cần ở giai đoạn 1
- **Backend:** [điền stack cụ thể — Node.js/Express hoặc Python/FastAPI]
- **App di động:** Flutter hoặc React Native — 2 app riêng biệt dùng chung backend:
  - `mobile-app-citizen`: app cho người dân
  - `mobile-app-officer`: app/kênh cho cán bộ phụ trách địa bàn
- **Notification:** Push notification nội bộ + fallback SMS/Zalo OA

## Cấu trúc thư mục
Xem chi tiết ở `docs/ARCHITECTURE.md`. Tóm tắt:
```
bao-tin/
├── backend/              # API, xử lý nghiệp vụ, geo-matching, crawler
├── mobile-app-citizen/   # App người dân
├── mobile-app-officer/   # App cán bộ phụ trách địa bàn
├── infra/                # Docker, migration scripts, deploy config
└── docs/                 # Toàn bộ tài liệu thiết kế
```

## Roadmap (chi tiết ở docs/ROADMAP.md)
- **Giai đoạn 1 (core):** báo tin dân + nút cấp cứu + geo-matching + xác minh cán bộ
- **Giai đoạn 2:** kênh tình báo mở (crawler MXH/báo chí, tách riêng UI)
- **Giai đoạn 3:** bản đồ cảnh báo, danh bạ khẩn cấp, liên kết ngược sang hệ thống tin bài chính
- **Giai đoạn 4 (để sau/mock khi demo):** NFC CCCD, độ nóng tin MXH, đối chiếu chéo, SLA dashboard

## Khi bắt đầu code, thứ tự ưu tiên
1. Schema database (`docs/DATABASE_SCHEMA.md`)
2. Nền tảng bảo mật auth (OTP hash, JWT + refresh token, rate limiting) — xem `docs/SECURITY.md` mục 1 và 3, làm cùng lúc với bước 1, không để sau
3. API báo tin cơ bản (`docs/API_SPEC.md`)
4. Module geo-matching (cần data ranh giới địa bàn — xem `backend/src/geo/`)
5. App người dân: màn hình Báo tin + Cấp cứu
6. App cán bộ: danh sách tin + xác minh trạng thái
7. Notification
8. Module crawler (song song, độc lập, không block các phần trên)
9. Trước khi demo/nộp bài: rà lại checklist bảo mật tối thiểu ở `docs/SECURITY.md` mục 7

## Lưu ý khi AI hỗ trợ code dự án này
- Luôn hỏi lại nếu thiếu dữ liệu ranh giới hành chính (geojson phường/xã) hoặc danh sách cán bộ phụ trách — đây là dữ liệu nền bắt buộc phải có trước khi geo-matching chạy được.
- Không tự ý gộp bảng dữ liệu tin MXH và tin dân báo trong schema — phải tách bảng hoặc tách rõ cột `source_type` + `trust_level`.
- Mọi tính năng liên quan cấp cứu (nút SOS) ưu tiên độ ổn định và tốc độ phản hồi hơn là tính năng phong phú.
- **Cuối mỗi phiên làm việc, ghi nhật ký vào `docs/NHATKY_<YYYY-MM-DD>.md`** (thư mục `docs/` đã gitignore — không commit/push). Nội dung: đã làm gì, quyết định/đánh đổi nào đã chốt, bug thật đã phát hiện + đã sửa (không phải chi tiết code, chỉ phần có giá trị tra cứu lại), việc còn thiếu/gợi ý cho phiên sau. Nếu cùng ngày có nhiều phiên, nối thêm vào file của ngày đó thay vì tạo file mới.
