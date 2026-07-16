# Roadmap phát triển — Báo Tin

## Giai đoạn 1 — Core (bắt buộc trước tiên)
Mục tiêu: chạy được luồng chính đầu-cuối, demo được.

- [x] Schema database (users, officers, districts, reports, attachments)
- [x] Nạp dữ liệu ranh giới hành chính (geojson) cho districts — **cần chuẩn bị dữ liệu, không chỉ code**
- [x] Nạp danh sách cán bộ + phân công địa bàn
- [x] API báo tin thường (ảnh + GPS EXIF + mô tả)
- [x] API báo tin khẩn cấp (nút SOS, tối giản luồng)
- [x] Module geo-matching (PostGIS)
- [x] Notification cơ bản (push, fallback SMS) — hiện là console-stub (`ConsoleNotificationSender`), chưa nối nhà cung cấp SMS/Zalo OA thật
- [x] App người dân: màn hình Báo tin + Cấp cứu + xem trạng thái
- [x] App cán bộ: danh sách tin theo địa bàn + xác nhận trạng thái
- [x] Đo `response_time_seconds` cho mỗi tin

## v1.1 — Module camera an ninh (bổ sung sau Giai đoạn 1)
Gợi ý tự động camera gần hiện trường để cán bộ chủ động liên hệ đơn vị quản lý xin trích xuất — hệ thống không bao giờ tự xem/tải/phân tích video (CLAUDE.md nguyên tắc #8).

- [x] Bảng `cameras` (vị trí, đơn vị quản lý + liên hệ) + `camera_extraction_requests`
- [x] API tự động khoanh vùng camera gần tọa độ tin báo (bán kính cấu hình được, PostGIS `ST_DWithin`)
- [x] API tạo/xem yêu cầu trích xuất (chỉ metadata hành chính, không có bước xử lý video)
- [x] App cán bộ: hiển thị camera gợi ý ngay trong màn chi tiết tin (tự động, không cần bấm tìm kiếm) + form tạo yêu cầu trích xuất — hiện là danh sách (list), chưa có bản đồ thật
- [x] Seed dữ liệu camera demo (rõ ràng là dữ liệu mẫu, giống cách seed cán bộ demo)

## v1.2 — Dashboard trung tâm điều hành (làm sớm hạng mục Giai đoạn 4)
Trang tổng quan cho `admin`/`senior_officer`, chạy trên máy tính (web), không dành cho `officer` thường.

- [x] API tổng hợp: tổng số tin, đếm theo status/urgency, thời gian phản hồi TB theo địa bàn/cán bộ, xu hướng theo ngày, hàng đợi yêu cầu trích xuất camera
- [x] `dashboard-web/` (Flutter Web) — KPI card + biểu đồ, lọc theo khoảng ngày + địa bàn
- [x] Seed 1 tài khoản demo role `admin` để đăng nhập thử

## Giai đoạn 2 — Kênh tình báo mở
Module độc lập, không block giai đoạn 1.

- [x] Bảng `social_media_signals` (tách biệt hoàn toàn khỏi `reports`)
- [x] Crawler nguồn báo chí (RSS) trước — `backend/src/crawler/`, nguồn VnExpress + Tuổi Trẻ (mục Pháp luật, đã xác minh URL thật); **chưa có nguồn báo Đắk Lắk** — không tìm thấy feed RSS công khai của baodaklak.vn, cần bổ sung thủ công nếu tìm được URL đúng
- [ ] Crawler MXH (nguồn public hợp lệ) sau — **chưa làm có chủ đích**: scrape Facebook/Zalo không qua API chính thức có rủi ro vi phạm điều khoản dịch vụ; kiến trúc (`RssSourceConfig`, `pressCrawler.service.ts`) đủ tổng quát để cắm thêm nguồn khi có API hợp lệ (vd. Facebook Graph API cho trang do đơn vị quản lý)
- [x] Cấu hình tần suất riêng theo từng nguồn — mỗi nguồn có `pollIntervalMinutes` riêng (`rssSources.ts`, `runCrawler.ts`)
- [x] Lọc từ khóa địa danh + loại vụ việc — `keywordFilter.ts`; tin không khớp từ khóa loại vụ việc nào sẽ không được lưu
- [x] AI tóm tắt 1-2 câu — `summarizer.ts`, chọn qua `LLM_PROVIDER` (openai/gemini/ollama/none), mặc định `none` = chỉ cắt ngắn văn bản gốc, không gọi API nào. `openai`/`gemini` đã có chỗ nhét API key nhưng **chưa có key thật nào được cấu hình**; `ollama` (model chạy local, không cần key) đã kiểm chứng chạy sống thật với `qwen2.5:1.5b` — xem mục "v1.7" bên dưới
- [x] Gộp tin trùng (dedup theo similarity) — `dedup.ts`, trigram Jaccard, chỉ gắn cờ "có thể trùng", không tự động gộp/xóa
- [x] UI riêng "Tin nhanh (tham khảo)" — tách biệt rõ khỏi tin đã xác thực (mobile-app-officer + dashboard-web)
- [x] Seed data mẫu để demo (không crawl live khi thi) — `seed-signals.ts`; crawler thật đã viết xong nhưng **chạy qua script riêng** (`npm run crawl:rss`), không tự khởi động cùng server (CLAUDE.md #4)

## Giai đoạn 3 — Trải nghiệm & liên kết
- [x] Bản đồ cảnh báo khu vực cho người dân (tổng hợp, không chi tiết nhạy cảm) — `GET /area-alerts`, đếm tin báo 30 ngày gần nhất theo xã/phường + `ST_Centroid` cho tọa độ hiển thị; app công dân vẽ marker màu theo mức cảnh báo qua `flutter_map`/OpenStreetMap (không cần API key trả phí), không có marker cho từng tin báo cụ thể
- [x] Danh bạ khẩn cấp tự động theo vị trí — `GET /emergency-contacts`, ưu tiên liên hệ theo địa bàn (fallback địa bàn gần nhất qua `ST_Centroid`/`<->` nếu tọa độ ngoài mọi ranh giới), rồi mới đến số quốc gia (113/114/115, số thật) cho loại chưa có liên hệ riêng. Số theo địa bàn cụ thể (công an/y tế phường) hiện là **[DEMO]** — chưa xác minh được số thật của từng đơn vị nên không đưa vào như thật
- [x] Lịch sử báo tin cá nhân đầy đủ
- [x] Chính sách ẩn danh với đối tượng vi phạm
- [x] API liên kết ngược sang phần mềm quản lý tin bài chính (`official_case_links`) — wiring + service thật (`officialCaseLink.service.ts`), nhưng phần gọi ra API bên thứ 3 vẫn là stub vì chưa có hệ thống đích thật để gọi
- [ ] Đồng bộ danh mục địa bàn giữa 2 hệ thống — **chưa làm được, cần thêm thông tin**: chưa biết API/schema của "phần mềm quản lý tin bài chính" (endpoint, xác thực, định dạng danh mục địa bàn phía đó) để thiết kế đồng bộ hai chiều; `official_case_links` ở trên chỉ mới liên kết 1 tin báo ↔ 1 case, không phải đồng bộ danh mục

## Giai đoạn 4 — Nâng cao (demo bằng mock nếu chưa kịp làm thật)
- [x] Quét NFC CCCD — mock UI trước, tích hợp thật qua VNeID/SDK sau. Đã làm mock UI ở cả 2 app: `mobile-app-officer` (xác minh danh tính tại hiện trường, trong màn chi tiết tin báo) và `mobile-app-citizen` (liên kết CCCD trong màn Hồ sơ). Toàn bộ dữ liệu hiển thị gắn nhãn `[MOCK]` rõ ràng, không có bất kỳ lời gọi NFC/chip thật nào (CLAUDE.md #5) — chưa tích hợp VNeID/SDK thật
- [x] Tính "độ nóng" tin MXH (cần dữ liệu chạy vài tuần) — `signalHeat.ts`, đếm số tín hiệu theo địa bàn trong 14 ngày gần nhất, phân mức low/medium/high. Công thức chạy đúng ngay cả khi ít dữ liệu; ý nghĩa thật sự cần chờ dữ liệu tích lũy theo thời gian như ghi chú gốc
- [x] Đối chiếu tin MXH với hồ sơ nội bộ đã có (liên kết chéo) — `getSignalDetail` trả thêm `relatedReports`: tin dân báo cùng địa bàn, trong vòng ±3 ngày quanh thời điểm tín hiệu. Chỉ mang tính tham khảo, không tự động kết luận là cùng vụ việc
- [x] Gợi ý "gửi tố cáo chính thức qua VNeID" cho tin nghiêm trọng — banner trong `report_status_screen.dart` (app công dân) khi tin có `urgency=emergency` hoặc thuộc nhóm loại vụ việc nghiêm trọng, chỉ là gợi ý văn bản, không có link/API VNeID thật nào được gọi
- [x] ~~Dashboard KPI: thời gian phản hồi trung bình theo địa bàn/cán bộ~~ — làm sớm ở v1.2 (xem mục v1.2 phía trên)

## v1.6 — Thông báo 2 chiều khi đổi trạng thái tin báo
Trả lời câu hỏi "phần mềm có thể nâng cấp vai trò truyền tin dân ↔ công an đến đâu": **dừng ở mức thông báo 2 chiều đơn giản**, không xây dựng chat/nhắn tin qua lại — giữ đúng định vị CLAUDE.md "Báo Tin bổ trợ VNeID, không thay thế".

- [x] Cán bộ đổi trạng thái → người dân báo tin nhận thông báo (nếu tin gắn tài khoản người dùng)
- [x] Ghi chú của cán bộ tại lần đổi trạng thái hiển thị lại cho người dân qua `GET /reports/:id/status` → `latestNote`
- [x] Sửa bug tồn tại từ Giai đoạn 1: `note` trong request body `PATCH /officer/reports/:id/status` chưa từng được lưu
- **Chưa làm có chủ đích**: chat/nhắn tin 2 chiều thật (cán bộ và dân trao đổi qua lại nhiều lượt) — ngoài phạm vi quyết định hiện tại, để đánh giá lại sau nếu cần

## v1.7 — Ollama làm tùy chọn AI tóm tắt (chạy local, không cần API key)
Kiểm thử khả năng tích hợp model AI chạy local cho crawler Giai đoạn 2: đối chiếu Ollama với `PrismML-Eng/Bonsai-demo` (repo demo model riêng của PrismML, cần HuggingFace token cho bản 27B mặc định + tải hàng chục GB) — chọn Ollama vì nhẹ hơn hẳn cho cùng mục đích tóm tắt ngắn.

- [x] `OllamaSummarizer` — gọi REST API local (`/api/chat`), không cần API key, dữ liệu không rời máy; cùng hợp đồng fallback-về-cắt-ngắn như OpenAI/Gemini khi lỗi
- [x] Kiểm chứng sống: cài Ollama qua winget, pull `qwen2.5:1.5b`, chạy `npm run crawl:rss` thật với `LLM_PROVIDER=ollama` — xác nhận model paraphrase đúng nghĩa tin thật từ Tuổi Trẻ, không chỉ cắt ngắn văn bản gốc

## Ưu tiên khi thời gian hạn chế (thi đấu)
Nếu không đủ thời gian làm hết Giai đoạn 1, thứ tự tối thiểu để demo được câu chuyện trọn vẹn:
1. Báo tin thường (ảnh + GPS + mô tả) — có thể mock geo-matching bằng dữ liệu cứng nếu chưa kịp tích hợp PostGIS thật
2. Nút cấp cứu
3. App cán bộ xem tin + xác nhận trạng thái
4. 1 vài tin mẫu trong "Tin nhanh (tham khảo)" để minh họa Giai đoạn 2 dù chưa code crawler thật
