# Tóm tắt dự án "Báo Tin" — đã làm gì và ứng dụng thực tế

> Tài liệu tổng hợp toàn bộ quá trình xây dựng, dùng để nắm nhanh bức tranh tổng thể. Chi tiết kỹ thuật xem thêm `docs/ARCHITECTURE.md`, `docs/API_SPEC.md`, `docs/DATABASE_SCHEMA.md`, `docs/SECURITY.md`, và lịch sử đầy đủ ở `CHANGELOG.md`/`docs/ROADMAP.md`.

## 1. Bài toán & định vị sản phẩm

"Báo Tin" là phần mềm **độc lập**, không phải module của hệ thống quản lý tin bài hiện có (dù có liên kết API 2 chiều). Mục tiêu: kênh **phản ứng nhanh cấp cơ sở** — người dân báo tin (kèm ảnh + GPS thật) hoặc tín hiệu mạng xã hội/báo chí được định tuyến ngay đến cán bộ phụ trách đúng địa bàn, rút ngắn thời gian xác minh so với các kênh hành chính thông thường.

**Định vị rõ ràng:** bổ trợ VNeID, không thay thế. VNeID = tố cáo chính thức có giá trị pháp lý. Báo Tin = phản ứng tức thời, tại chỗ. Quyết định này được giữ xuyên suốt dự án — kể cả khi có ý tưởng mở rộng vai trò truyền tin dân ↔ công an, đã chủ động dừng ở mức "thông báo 2 chiều đơn giản" thay vì xây dựng thành kênh liên lạc chính thức (xem mục 6).

## 2. Tech stack

- **Database:** PostgreSQL + PostGIS (dữ liệu quan hệ + địa lý), truy vấn geo qua raw SQL tham số hoá (`$queryRaw`/`$executeRaw`, không nối chuỗi — xem `docs/adr/0001`)
- **Object storage:** MinIO (on-premise) cho ảnh — chỉ lưu path trong Postgres, không lưu blob
- **Backend:** Node.js + TypeScript + Express, Prisma ORM, Zod validation, JWT RS256 + refresh-token rotation, vitest
- **3 app Flutter riêng biệt, versioned độc lập, dùng chung backend:**
  - `mobile-app-citizen` — app người dân (v1.4.0+6)
  - `mobile-app-officer` — app cán bộ phụ trách địa bàn (v1.3.0+4)
  - `dashboard-web` — trang tổng quan cho admin/senior_officer, chạy trình duyệt (v1.4.0+3)
  - Riverpod (state), Dio (HTTP), flutter_secure_storage (token), flutter_map + OpenStreetMap (bản đồ, không cần API key trả phí)
- **Notification:** kiến trúc pluggable (`NotificationSender` interface), hiện dùng `ConsoleNotificationSender` (log có cấu trúc) — **chưa nối nhà cung cấp SMS/push/Zalo OA thật**

## 3. Đã xây dựng những gì — theo từng giai đoạn

### Giai đoạn 1 — Core (v1.0.0)
- Auth: OTP + blind-index số điện thoại (không lưu SĐT dạng dò được), JWT RS256 + refresh-token rotation, rate-limit theo địa chỉ/số điện thoại
- Báo tin thường: ảnh (giữ nguyên EXIF GPS, upload trực tiếp trong app) + mô tả + vị trí
- Báo tin khẩn cấp (nút SOS): luồng tối giản, không kèm ảnh, ưu tiên tốc độ phản hồi
- Geo-matching thật bằng PostGIS với ranh giới 102 xã/phường tỉnh Đắk Lắk (`data/raw/Daklak.geojson`) + tự động gán cán bộ phụ trách
- App cán bộ: danh sách tin theo địa bàn (sắp theo mức ưu tiên), xem chi tiết, xác nhận trạng thái (Đúng sự thật / Đang xác minh / Tin sai) — luôn cần cán bộ chọn tay, không có bước AI tự kết luận
- Chặn chéo địa bàn: cán bộ chỉ thấy tin thuộc địa bàn được phân công (trừ `senior_officer`/`admin`)
- Ẩn danh tính người báo tin với đối tượng vi phạm khi cần + audit log cho lượt xem thông tin nhạy cảm
- Đo `response_time_seconds` cho mỗi tin

### v1.1 — Module camera an ninh
- Tự động khoanh vùng camera gần tọa độ tin báo (PostGIS `ST_DWithin`)
- Cán bộ tạo yêu cầu trích xuất gửi đơn vị quản lý — **hệ thống không kết nối/xem/tải/phân tích video** (nguyên tắc bắt buộc: chỉ định vị + tạo yêu cầu hành chính)

### v1.2 — Dashboard trung tâm điều hành
- `dashboard-web` (Flutter Web): KPI tổng số tin, thời gian phản hồi TB theo địa bàn/cán bộ, xu hướng theo ngày, hàng đợi yêu cầu trích xuất camera
- Tab "Tin báo" ngay trên dashboard (tái dùng API `/officer/reports*` có sẵn)
- Xử lý session hết hạn tự động đưa về màn đăng nhập; camera-fetch phân biệt lỗi thật với "không có dữ liệu"; bộ lọc địa bàn áp dụng đúng cho từng loại biểu đồ

### Giai đoạn 2 (v1.3.0) — Kênh tình báo mở
- Bảng `social_media_signals` **tách biệt hoàn toàn** khỏi `reports` — không bao giờ trộn lẫn hay tự động chuyển thành hồ sơ chính thức
- Crawler RSS thật (VnExpress + Tuổi Trẻ, mục Pháp luật — URL đã xác minh thủ công), chạy qua script riêng (`npm run crawl:rss`), **không tự khởi động cùng server** khi demo
- Lọc từ khóa địa danh (đối chiếu cả tên xã/phường cũ và mới sau sáp nhập 2025, có 2 lớp an toàn chống nhầm lẫn) + loại vụ việc
- Tóm tắt AI tùy chọn (OpenAI/Gemini, mặc định tắt), gộp tin trùng theo similarity (chỉ gắn cờ, không tự xóa/gộp)
- UI "Tin nhanh (tham khảo)" tách biệt hoàn toàn về màu sắc/nhãn với tin dân báo, trên cả app cán bộ và dashboard-web

### Giai đoạn 3 (v1.4.0) — Trải nghiệm & liên kết
- Bản đồ cảnh báo khu vực cho dân (`GET /area-alerts`) — chỉ số liệu tổng hợp theo xã/phường, không hiện chi tiết tin báo cụ thể
- Danh bạ khẩn cấp tự động theo vị trí GPS — ưu tiên số riêng theo địa bàn (demo), fallback số quốc gia thật (113/114/115)
- API liên kết ngược sang hệ thống tin bài chính (`official_case_links`) — wiring thật, phần gọi API bên thứ 3 vẫn là stub vì chưa có hệ thống đích thật
- **Chưa làm**: đồng bộ danh mục địa bàn giữa 2 hệ thống — thiếu thông tin API/schema phía hệ thống chính

### Giai đoạn 4 (v1.5.0) — Nâng cao (mock nếu chưa kịp làm thật)
- Quét NFC CCCD — **mock UI** ở cả 2 app (không tự viết code đọc chip thật, nhãn `[MOCK]` rõ ràng)
- Độ nóng tín hiệu MXH (`signalHeat.ts`) — đếm theo địa bàn trong 14 ngày, phân mức low/medium/high
- Đối chiếu chéo tín hiệu MXH ↔ tin dân báo cùng địa bàn/khung thời gian — chỉ tham khảo, không tự kết luận cùng vụ việc
- Gợi ý gửi tố cáo chính thức qua VNeID cho tin nghiêm trọng — chỉ là văn bản gợi ý, không gọi API VNeID thật

### v1.6.0 — Thông báo 2 chiều khi đổi trạng thái
- Cán bộ đổi trạng thái → người dân báo tin được thông báo (nếu tin gắn tài khoản)
- Ghi chú của cán bộ tại lần đổi trạng thái gần nhất hiển thị lại cho dân qua app (`latestNote`)
- Sửa 1 bug tồn tại từ Giai đoạn 1: API đã nhận `note` nhưng chưa từng lưu
- **Quyết định phạm vi rõ ràng:** dừng ở mức thông báo 2 chiều, không xây dựng chat/nhắn tin qua lại nhiều lượt — giữ đúng định vị bổ trợ VNeID

### v1.7.0 — Ollama làm tùy chọn AI tóm tắt cho crawler
- Thêm `OllamaSummarizer` — chạy model AI local qua Ollama (không cần API key, dữ liệu không rời máy), cùng hợp đồng fallback-về-cắt-ngắn như OpenAI/Gemini khi lỗi
- Đã đối chiếu với `PrismML-Eng/Bonsai-demo` (nặng hơn hẳn: cần HuggingFace token cho bản 27B mặc định, tải hàng chục GB) — chọn Ollama vì nhẹ, khớp ngay với kiến trúc `Summarizer` sẵn có
- Kiểm chứng sống: cài Ollama, pull `qwen2.5:1.5b`, chạy crawler thật — model paraphrase đúng nghĩa tin thật, không chỉ cắt ngắn văn bản
- Không đổi hành vi mặc định — `LLM_PROVIDER` vẫn mặc định `none`

### v1.8.0 — 4 tính năng AI hỗ trợ dùng Ollama, opt-in, chỉ gợi ý (mới nhất)
Toàn bộ tắt hoàn toàn nếu không cấu hình `LLM_PROVIDER=ollama`; mọi tính năng chỉ gợi ý/hỗ trợ, không có bước nào tự động kết luận thay con người.
- Lọc tín hiệu MXH thông minh hơn — AI xét thêm sau khi khớp từ khóa, chỉ có thể loại bớt tin chứ không nhận thêm. **Ghi nhận thật khi kiểm thử sống**: model nhỏ `qwen2.5:1.5b` đôi khi đánh giá sai (từ chối nhầm 1 tin cháy nổ có thật) — độ chính xác phụ thuộc model, cần model lớn hơn nếu muốn dùng nghiêm túc
- Gộp tin trùng theo ngữ nghĩa — chỉ hỏi AI cho các cặp tin ở vùng biên similarity (0.15–0.5), tiết kiệm chi phí gọi model
- Diễn giải độ nóng khu vực bằng 1-2 câu — chỉ tính khi độ nóng medium/high, hiển thị ở app cán bộ + dashboard, nhãn rõ "AI, chỉ tham khảo"
- Gợi ý phân loại tin báo cho người dân — pre-fill dropdown sau khi gõ mô tả, không bao giờ ghi đè lựa chọn thủ công
- Trợ lý tìm kiếm ngôn ngữ tự nhiên (tab mới trên dashboard-web) — AI chỉ trích xuất bộ lọc (địa bàn/thời gian/từ khóa), không tự trả lời bằng văn bản riêng; kết quả luôn là dữ liệu thật từ database, tin báo/tín hiệu MXH vẫn hiển thị tách biệt 2 danh sách
- Đã kiểm chứng sống toàn bộ qua Docker + Ollama thật với dữ liệu seed thật

## 4. Ứng dụng thực tế — luồng sử dụng theo từng vai trò

**Người dân (mobile-app-citizen):**
1. Đăng nhập bằng OTP qua số điện thoại (không cần tài khoản/mật khẩu phức tạp)
2. Gặp sự việc → mở app, chụp ảnh trực tiếp (không qua Zalo/Messenger để giữ EXIF GPS) hoặc bấm nút SOS khẩn cấp
3. Hệ thống tự định tuyến tới đúng cán bộ phụ trách xã/phường dựa trên tọa độ GPS
4. Theo dõi trạng thái tin báo của mình, thấy ghi chú cán bộ để lại khi cập nhật trạng thái, nhận thông báo khi có thay đổi
5. Xem bản đồ cảnh báo khu vực + danh bạ khẩn cấp gọi nhanh (113/114/115 hoặc số địa phương)
6. Với tin nghiêm trọng, được gợi ý cân nhắc gửi tố cáo chính thức qua VNeID song song
7. (Mock) liên kết CCCD trong màn Hồ sơ — minh họa hướng tích hợp định danh sau này qua VNeID/SDK chính thức

**Cán bộ phụ trách địa bàn (mobile-app-officer):**
1. Đăng nhập OTP, chỉ thấy tin thuộc địa bàn được phân công (trừ cấp senior_officer/admin)
2. Danh sách tin sắp xếp ưu tiên (khẩn cấp trước), xem chi tiết kèm ảnh + vị trí trên bản đồ
3. Xem gợi ý camera an ninh gần hiện trường, tạo yêu cầu trích xuất gửi đơn vị quản lý (không tự xem video)
4. Xác nhận trạng thái (Đúng sự thật/Đang xác minh/Tin sai) kèm ghi chú — hành động này tự động thông báo ngược lại cho người dân
5. Tin xác nhận đúng + nghiêm trọng tự động đẩy sang hệ thống tin bài chính qua API liên kết
6. Xem thêm "Tin nhanh" từ báo chí/MXH liên quan địa bàn để tham khảo (rõ ràng tách biệt, không phải tin đã xác thực), kèm độ nóng và đối chiếu chéo với tin dân báo
7. (Mock) quét CCCD hiện trường để xác minh danh tính người liên quan

**Trung tâm điều hành (dashboard-web, admin/senior_officer):**
1. Xem tổng quan KPI: số tin, thời gian phản hồi trung bình theo địa bàn/cán bộ, xu hướng theo ngày
2. Quản lý tin báo không giới hạn địa bàn, hàng đợi yêu cầu trích xuất camera
3. Theo dõi tín hiệu MXH/báo chí trên diện rộng qua module Giai đoạn 2

## 5. Nguyên tắc thiết kế đã tuân thủ xuyên suốt

- Tin MXH/báo chí không bao giờ hiển thị chung hoặc tự động biến thành hồ sơ chính thức — luôn cần cán bộ xác nhận
- Mọi xác minh đều có con người quyết định (human-in-the-loop), không có bước AI tự kết luận đúng/sai
- Không crawl trực tiếp khi demo — dùng seed data mẫu, crawler thật chạy tách biệt qua script riêng
- Không tự viết code đọc chip NFC CCCD — chỉ mock UI
- Giữ nguyên EXIF GPS ảnh — bắt buộc chụp/chọn trực tiếp trong app
- Bảo mật làm từ đầu (OTP hash, blind-index SĐT, JWT + refresh rotation, rate-limit, mã hoá trường định danh) — không phải làm sau
- Camera chỉ định vị + tạo yêu cầu hành chính, không có nhận diện khuôn mặt/truy tìm đối tượng qua video

## 6. Những gì còn thiếu / cố ý chưa làm (thành thật ghi nhận)

- **Chưa nối nhà cung cấp SMS/push/Zalo OA thật** — notification hiện chỉ log ra console, cần chọn provider thật trước khi lên production
- **Crawler MXH (Facebook/Zalo)** chưa làm — scrape ngoài API chính thức có rủi ro vi phạm điều khoản dịch vụ; kiến trúc đã đủ tổng quát để cắm thêm khi có API hợp lệ
- **Chưa tìm được RSS công khai của báo Đắk Lắk** — đã kiểm tra, không có, không tự bịa URL
- **Chưa đồng bộ danh mục địa bàn** giữa Báo Tin và hệ thống tin bài chính — thiếu thông tin API/schema phía đối tác
- **API liên kết ngược sang hệ thống chính** mới có wiring, phần gọi API bên thứ 3 thật vẫn là stub (chưa có hệ thống đích để gọi thật)
- **Số điện thoại khẩn cấp theo địa bàn cụ thể** (công an/y tế phường) hiện là dữ liệu `[DEMO]`, chưa xác minh số thật
- **NFC CCCD** mới dừng ở mock UI, chưa tích hợp VNeID/SDK chính thức của Bộ Công an
- **Chat/nhắn tin 2 chiều đầy đủ** giữa dân và cán bộ — cố ý không làm, hiện chỉ dừng ở thông báo 1 chiều mỗi khi đổi trạng thái + ghi chú đi kèm
- **Độ chính xác của các tính năng AI (Ollama) phụ thuộc vào model** — kiểm thử sống với model nhỏ `qwen2.5:1.5b` cho thấy bộ lọc liên quan tín hiệu MXH đôi khi từ chối nhầm tin thật; cần cân nhắc model lớn hơn nếu muốn dùng nghiêm túc ngoài mục đích minh họa/demo

## 7. Trạng thái phiên bản hiện tại

| Package | Version |
|---|---|
| backend | 1.8.0 |
| dashboard-web | 1.5.0+4 |
| mobile-app-officer | 1.4.0+5 |
| mobile-app-citizen | 1.5.0+7 |

Toàn bộ đã qua `tsc --noEmit`, `vitest run`, `flutter analyze`, `flutter test` sạch lỗi ở lần release gần nhất (v1.8.0), và được xác minh sống (live) qua Docker Compose (Postgres+PostGIS, MinIO) + Ollama thật (`qwen2.5:1.5b`) trước khi release.
