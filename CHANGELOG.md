# Changelog

## backend 1.7.0 — Thêm Ollama làm tùy chọn AI tóm tắt cho crawler (Giai đoạn 2)
Thử nghiệm khả năng tích hợp model AI chạy local: đối chiếu Ollama với `PrismML-Eng/Bonsai-demo`, chọn Ollama vì nhẹ hơn hẳn (không cần HuggingFace token/repo private, không cần tải hàng chục GB) và có REST API đơn giản khớp ngay với kiến trúc `Summarizer` sẵn có.

- `OllamaSummarizer` (`backend/src/crawler/summarizer.ts`) — gọi `POST /api/chat` của Ollama chạy local, không cần API key, dữ liệu không rời khỏi máy. Cùng hợp đồng fallback như OpenAI/Gemini: lỗi/model chưa pull/server chưa chạy đều rơi về cắt ngắn văn bản, không bao giờ làm crawler crash.
- `LLM_PROVIDER=ollama` (thêm vào enum có sẵn `openai`/`gemini`/`none`) + `OLLAMA_BASE_URL` (mặc định `http://localhost:11434`) + `OLLAMA_MODEL` (mặc định `qwen2.5:1.5b`).
- Đã kiểm chứng sống: cài Ollama, pull `qwen2.5:1.5b`, chạy `npm run crawl:rss` thật với `LLM_PROVIDER=ollama` — crawler lấy tin thật từ Tuổi Trẻ và model tóm tắt đúng nghĩa (paraphrase, không chỉ cắt ngắn).
- Không đổi hành vi mặc định — `LLM_PROVIDER` vẫn mặc định `none` nếu không cấu hình.

## backend 1.6.0 · mobile-app-citizen 1.4.0+6 — Thông báo 2 chiều khi cán bộ đổi trạng thái tin báo
Dừng ở mức noti 2 chiều đơn giản (không xây dựng chat/nhắn tin qua lại) — đúng định vị "Báo Tin bổ trợ VNeID, không thay thế" trong CLAUDE.md, không mở rộng vai trò sản phẩm thành kênh liên lạc đầy đủ giữa dân và công an.

- Cán bộ đổi trạng thái tin báo → người dân báo tin (nếu có `userId`, không áp dụng cho tin ẩn danh/SOS không gắn tài khoản) nhận thông báo qua kênh hiện có (`ConsoleNotificationSender` — chưa nối nhà cung cấp SMS/Zalo OA thật).
- **Sửa 1 bug tồn tại từ trước**: API `PATCH /officer/reports/:id/status` vốn đã nhận `note` trong request body nhưng chưa từng lưu lại — nay lưu vào cột mới `report_status_history.note`.
- `GET /reports/:id/status` (app công dân) trả thêm `latestNote` — ghi chú của cán bộ tại lần đổi trạng thái gần nhất (`null` nếu tin chưa từng đổi trạng thái).
- **App công dân** — màn "Trạng thái tin báo" hiển thị ghi chú của cán bộ (nếu có) ngay dưới thời điểm xác minh.
- Vẫn tuân thủ human-in-the-loop (CLAUDE.md #3): thông báo chỉ phát sinh từ hành động chọn trạng thái thủ công của cán bộ, không có bước tự động nào kết luận thay.

## backend 1.5.0 · dashboard-web 1.4.0+3 · mobile-app-officer 1.3.0+4 · mobile-app-citizen 1.3.0+5 — Giai đoạn 4: NFC CCCD (mock), độ nóng MXH, đối chiếu chéo, gợi ý VNeID
- **Quét NFC CCCD (mock UI)** — cả 2 app: `mobile-app-officer` (xác minh danh tính tại hiện trường, nút trong màn chi tiết tin báo) và `mobile-app-citizen` (liên kết CCCD, màn "Hồ sơ" mới). Toàn bộ dữ liệu hiển thị gắn nhãn `[MOCK]` rõ ràng, không có lời gọi NFC/chip thật nào (CLAUDE.md #5) — chưa tích hợp VNeID/SDK thật.
- **Độ nóng tin MXH** (`signalHeat.ts`) — đếm số tín hiệu theo địa bàn trong 14 ngày gần nhất, phân mức `low`/`medium`/`high`; hiển thị badge 🔥 trên danh sách + chi tiết tín hiệu ở cả `mobile-app-officer` và `dashboard-web`. Công thức tính đúng ngay cả khi ít dữ liệu.
- **Đối chiếu chéo tin MXH ↔ tin dân báo** — `GET /officer/signals/:id` trả thêm `relatedReports`: tin dân báo cùng địa bàn trong vòng ±3 ngày quanh thời điểm tín hiệu. Chỉ tham khảo, không tự động kết luận cùng vụ việc — hiển thị kèm chú thích rõ ràng ở cả 2 app.
- **Gợi ý gửi tố cáo chính thức qua VNeID** — banner trên màn trạng thái tin báo (`mobile-app-citizen`) khi tin có `urgency=emergency` hoặc thuộc nhóm loại vụ việc nghiêm trọng (`chay_no`/`tai_nan`/`an_ninh_khan_cap`, cùng danh mục với backend). Chỉ là gợi ý văn bản, không gọi API/link VNeID thật nào.
- `GET /reports/:id/status` (app công dân) trả thêm `urgency`/`category` để tính được tin có "nghiêm trọng" hay không.

## backend 1.4.0 · mobile-app-citizen 1.2.0+4 — Giai đoạn 3: Bản đồ cảnh báo + danh bạ khẩn cấp
- **`GET /area-alerts?lat=&lng=`** — bản đồ cảnh báo khu vực cho người dân, dữ liệu tổng hợp: đếm tin báo 30 ngày gần nhất theo từng xã/phường (`ST_Centroid` cho tọa độ hiển thị), phân mức `low`/`medium`/`high` theo ngưỡng số lượng. Không bao giờ trả về vị trí hay chi tiết của từng tin báo cụ thể.
- **`GET /emergency-contacts?lat=&lng=`** — danh bạ khẩn cấp tự động theo vị trí: khớp địa bàn qua tọa độ (fallback địa bàn gần nhất nếu điểm nằm ngoài mọi ranh giới), ưu tiên liên hệ riêng của địa bàn đó, những loại (police/medical/fire) chưa có liên hệ riêng thì dùng số quốc gia thật (113/114/115). Liên hệ riêng theo địa bàn hiện là `[DEMO]` vì chưa xác minh được số thật của từng đơn vị.
- **App công dân — tab "Khu vực"** mới: bản đồ (OpenStreetMap qua `flutter_map`, không cần API key trả phí) với marker màu theo mức cảnh báo từng xã/phường + danh bạ khẩn cấp bấm gọi trực tiếp (`url_launcher`). Tái dùng nguyên `LocationResolver` đã có sẵn cho báo tin thường.
- Bảng mới `emergency_contacts` (`districtId` nullable — null = mặc định/toàn quốc).
- **Chưa làm**: "Đồng bộ danh mục địa bàn giữa 2 hệ thống" — thiếu thông tin API/schema của phần mềm quản lý tin bài chính để thiết kế, cần hỏi thêm trước khi làm.

## backend 1.3.0 · dashboard-web 1.3.0+2 · mobile-app-officer 1.2.0+3 · mobile-app-citizen 1.1.1+3 — Giai đoạn 2 (bắt đầu): Kênh tình báo mở
Semantic versioning per package từ đây trở đi (mỗi package versioned độc lập trong package.json/pubspec.yaml riêng — MAJOR.MINOR.PATCH, `+N` là build number của Flutter). backend/dashboard-web/mobile-app-officer đều lên MINOR (tính năng mới, tương thích ngược); mobile-app-citizen chỉ lên PATCH (chỉ có bugfix, không có tính năng người dùng mới).

**Bảo mật:**
- CORS giới hạn theo allow-list (`CORS_ALLOWED_ORIGINS`), không còn mở cho mọi origin.
- `APP_DATABASE_URL` (role least-privilege) bắt buộc phải có ở production — trước đây nếu thiếu sẽ âm thầm chạy bằng role owner/migrator (toàn quyền DDL).

**Hoàn thiện dashboard-web:**
- Xử lý session hết hạn: tự động đưa về màn đăng nhập thay vì treo ở màn lỗi vĩnh viễn.
- Bộ lọc địa bàn giờ áp dụng đúng cho chart "theo cán bộ" + "xu hướng số tin" (trước đây 2 chart này bỏ qua bộ lọc); chart "theo địa bàn" cố ý giữ nguyên không lọc (biểu đồ so sánh giữa các địa bàn) kèm chú thích rõ ràng.
- Phân biệt đúng trạng thái lỗi tải camera gần hiện trường với trạng thái "không có camera nào" (trước đây bị nuốt làm một).
- Hoàn thiện nốt bộ lọc địa bàn ở tab "Tin báo" (đã có ở backend/repository nhưng chưa có UI).
- Nút làm mới giờ cũng nạp lại danh sách địa bàn; màn OTP có nút "Gửi lại mã" (cooldown 30s).
- 3 bug backend phát hiện khi chạy live-test lần đầu (unit test dùng Prisma giả nên không bắt được): `otp_challenges.user_id` bị gán nhầm ID của officer trong khi cột này chỉ FK vào bảng `users` (chặn đứng toàn bộ đăng nhập officer/admin); `make_interval(days => bigint)` thiếu cast `::int`; `nearbyCameras` cast nhầm `reportId` thành `::uuid` trong khi cột thật là `text`.

- **"Tin nhanh (tham khảo)"** — màn hình/tab mới trên cả `mobile-app-officer` và `dashboard-web`, đọc từ bảng `social_media_signals` đã có sẵn từ trước. Tách biệt hoàn toàn khỏi luồng tin dân báo: không có nhãn trạng thái, không có nút xác nhận/duyệt, chỉ có nhãn nguồn (Báo chí / MXH — chưa xác thực) với màu sắc riêng (tím/xám, không trùng statusColor/urgencyColor) — CLAUDE.md nguyên tắc #1/#2.
- API mới (đọc-only): `GET /officer/signals`, `GET /officer/signals/:id` — cùng cơ chế district-scoping như `/officer/reports` (officer thường chỉ thấy tín hiệu thuộc địa bàn được phân công, senior_officer/admin thấy tất cả).
- Seed dữ liệu mẫu (`seed-signals.ts`) mô phỏng kết quả crawler báo chí/MXH.
- Tiện thể sửa 1 bug tiềm ẩn: `setState(() => _future = _load())` — cú pháp arrow-function khiến callback bị coi là "trả về Future", Flutter framework báo lỗi runtime khi bấm filter chip. Có ở cả `mobile-app-officer` (2 màn) và `mobile-app-citizen` (1 màn), sửa thành block-body.
- **Crawler RSS báo chí thật** (`backend/src/crawler/`) — nguồn VnExpress + Tuổi Trẻ (mục Pháp luật, URL đã xác minh thủ công); lọc theo từ khóa loại vụ việc, nhận diện địa bàn theo tên xã/phường, gộp tin trùng theo trigram similarity, tóm tắt 1-2 câu qua LLM chọn được (OpenAI/Gemini, mặc định `none` = cắt ngắn văn bản gốc). Chạy qua script riêng `npm run crawl:rss`, **không tự khởi động cùng server** (CLAUDE.md #4). Chưa tìm được feed RSS công khai của báo Đắk Lắk; chưa làm crawler MXH (Facebook/Zalo) vì scrape ngoài API chính thức có rủi ro vi phạm điều khoản dịch vụ — kiến trúc đã đủ tổng quát để cắm thêm khi có API hợp lệ.
- **Chỉnh độ chuẩn từ khóa địa danh** (`keywordFilter.ts`) — phát hiện ra `sap_nhap` trong geojson chứa tên xã/phường **cũ** đã gộp vào xã/phường mới sau sáp nhập 2025 (vd. "Buôn Ma Thuột" gộp từ "Tân Tiến, Tự An, Tân Lợi, Cư Êbur"...); báo chí thực tế hầu như luôn dùng tên cũ. `detectDistrict` giờ so khớp cả tên mới lẫn tên cũ, có 2 lớp an toàn: (1) chỉ chạy khi văn bản có nhắc tên tỉnh Đắk Lắk/Phú Yên (chặn các tên xã/phường cũ trùng từ thông dụng như "Đoàn Kết", "Thống Nhất" khớp nhầm tin không liên quan), (2) loại bỏ hẳn tên nào bị trùng giữa ≥2 xã/phường mới (vd. "Ea Bar" từng có ở cả huyện Sông Hinh lẫn Buôn Đôn cũ) thay vì gán đại — kiểm chứng trên dữ liệu thật: 302 bí danh tổng, 282 dùng được, 20 bị loại vì trùng.

## 1.2.0
- Thêm `dashboard-web/` (Flutter Web) — trang tổng quan cho `admin`/`senior_officer` chạy trên máy tính trung tâm: KPI tổng số tin, thời gian phản hồi TB theo địa bàn/cán bộ, xu hướng theo ngày, hàng đợi yêu cầu trích xuất camera.
- API mới: `GET /admin/dashboard/overview`, `/response-time-by-district`, `/response-time-by-officer`, `/volume-trend`, `/camera-queue`.
- Seed thêm 1 tài khoản demo role `admin`.
- **Seed:** mọi xã/phường trong số 102 xã/phường đã seed nay đều có ít nhất 1 cán bộ demo được phân công (trước đây chỉ 4/102) — để tin báo ở bất kỳ xã/phường nào cũng geo-matching ra được cán bộ nhận thông báo, không chỉ 4 địa bàn demo ban đầu (`seed-officers.ts` → `seedOfficersForAllDistricts`).
- **Tab "Tin báo" trên dashboard** — danh sách tin báo mới (lọc trạng thái/khẩn cấp) + chi tiết + duyệt trạng thái (Đúng sự thật/Đang xác minh/Tin sai) + gợi ý camera gần hiện trường, ngay trên `dashboard-web`. Tái dùng nguyên endpoint `/officer/reports*` đã có (không cần API mới — 2 role này vốn đã được phép truy cập không giới hạn địa bàn). Tự làm mới danh sách mỗi 20s để tin mới hiện lên không cần bấm F5.

## 1.1.0
- Thêm module camera an ninh: tự động khoanh vùng camera gần tọa độ tin báo (PostGIS `ST_DWithin`), cán bộ tạo yêu cầu trích xuất gửi đơn vị quản lý — hệ thống không kết nối/xem/tải/phân tích video (CLAUDE.md nguyên tắc #8).
- Bảng mới: `cameras`, `camera_extraction_requests`.
- API mới: `GET /officer/reports/:id/nearby-cameras`, `POST /officer/reports/:id/camera-extraction-requests`, `GET /officer/reports/:id/camera-extraction-requests`.

## 1.0.0 — Giai đoạn 1 (core)
- Auth: OTP hash + blind-index SĐT, JWT RS256 + refresh rotate, rate-limit theo SECURITY.md.
- Báo tin thường (giữ EXIF GPS) + Cấp cứu (luồng tối giản).
- Geo-matching PostGIS thật với 102 xã/phường Đắk Lắk (`data/raw/Daklak.geojson`) + gán cán bộ.
- App cán bộ: danh sách ưu tiên, chi tiết, xác minh trạng thái, chặn chéo địa bàn, ẩn danh tính + audit log.
- 2 app Flutter (citizen + officer) — đã xác nhận `flutter analyze`/`flutter test` pass.
