# 🛡️ Báo Tin

**Hệ thống tiếp nhận & xử lý tin báo an ninh trật tự cấp cơ sở**

Kênh phản ứng nhanh cho người dân báo tin trực tiếp tới cán bộ phụ trách địa bàn — định
tuyến tức thời theo vị trí GPS, rút ngắn thời gian xác minh so với các kênh hành chính
thông thường.

`Phiên bản hiện tại: backend 1.22.1 · dashboard-web-react 0.3.1 · dashboard-web 1.6.1+6 · mobile-app-officer 1.13.0+17 · mobile-app-citizen 1.9.1+13`

> Tài liệu thiết kế chi tiết (SECURITY.md, ARCHITECTURE.md, API_SPEC.md, DATABASE_SCHEMA.md,
> ROADMAP.md, CHANGELOG.md, ADR...) được lưu và duy trì cục bộ trên máy phát triển, không
> publish lên remote repo này — chỉ `README.md` và [`CLAUDE.md`](CLAUDE.md) (quy tắc thiết
> kế bắt buộc) được đưa lên. README này tóm tắt đủ để ai đọc từ remote cũng nắm được bức
> tranh tổng thể.

---

## Giới thiệu

Khi có sự việc xảy ra ngoài đời, kênh báo tin hành chính thông thường (kể cả VNeID) đúng
nhưng chậm — nhiều bước, không định vị được ngay tin đó thuộc địa bàn nào, không tự động
tới đúng người phụ trách. **Báo Tin** thu hẹp khoảng đó ở lớp phản ứng đầu tiên: người dân
báo tin **kèm định vị GPS thật** (ảnh/video chụp trực tiếp trong app, giữ nguyên EXIF —
không qua trung gian Zalo/Messenger vì các nền tảng đó thường xóa EXIF), hệ thống dùng
PostGIS khoanh vùng địa bàn ngay lập tức và đẩy thẳng tới cán bộ phụ trách xã/phường đó,
không cần chờ luân chuyển qua nhiều cấp.

Mọi tin đều đi qua một cán bộ con người trước khi trở thành "đã xác thực" — không có bước
AI nào tự kết luận đúng/sai. Tín hiệu từ mạng xã hội/báo chí (giai đoạn 2) được xử lý và
hiển thị hoàn toàn tách biệt khỏi tin dân báo, không bao giờ trộn lẫn hay tự động nâng cấp
thành hồ sơ chính thức.

**Định vị:** bổ trợ VNeID, không thay thế. VNeID là kênh tố cáo chính thức có giá trị pháp
lý; Báo Tin là phản ứng tức thời, tại chỗ, cấp cơ sở.

## Nguyên tắc thiết kế bắt buộc (chi tiết ở [`CLAUDE.md`](CLAUDE.md))

1. Tin từ mạng xã hội/báo chí **không bao giờ** hiển thị lẫn hoặc gắn nhãn giống tin dân
   báo đã xác thực — luôn tách UI, luôn gắn nhãn nguồn + độ tin cậy.
2. **Không có workflow nào tự động** kết luận đúng/sai hay tự đẩy tin sang hồ sơ chính
   thức — mọi tin đều cần cán bộ phụ trách địa bàn chọn trạng thái xác minh (human-in-the-loop).
3. Không crawl trực tiếp khi demo — module crawler dùng seed data mẫu, crawler thật chạy
   tách biệt qua script riêng.
4. Không tự viết code đọc chip NFC CCCD — chỉ mock UI, tích hợp thật (nếu làm) phải qua
   VNeID/SDK chính thức của Bộ Công an.
5. Giữ nguyên EXIF GPS ảnh gốc — người dân phải chụp/chọn ảnh trực tiếp trong app.
6. Bảo mật là yêu cầu từ đầu — mã hoá AES-256-GCM cho dữ liệu định danh, JWT RS256 + refresh
   rotation, rate-limit OTP, không phải hạng mục "làm sau khi có thời gian".
7. Các tính năng AI hỗ trợ (Ollama, xem mục bên dưới) **chỉ gợi ý**, không có bước nào tự
   động kết luận thay con người.

## Tech stack

- **Database:** PostgreSQL + PostGIS · **Object storage:** MinIO (chỉ lưu path trong Postgres)
- **Backend:** Node.js + TypeScript + Express, Prisma ORM, Zod, JWT RS256 + refresh rotation, vitest
- **3 app Flutter riêng biệt, versioned độc lập, dùng chung backend:** `mobile-app-citizen` (người dân), `mobile-app-officer` (cán bộ phụ trách địa bàn **và** admin/senior_officer — từ v1.20 đã gộp đủ mọi màn quản trị: thống kê, duyệt/quản lý tài khoản, trợ lý tìm kiếm, chat liên đơn vị — nên admin không bắt buộc phải dùng `dashboard-web-react` nữa), `dashboard-web` (bản Flutter Web cũ hơn, vẫn chạy song song) — Riverpod, Dio, flutter_secure_storage, flutter_map/OpenStreetMap
- **`dashboard-web-react`:** phiên bản React của web quản lý, dùng chung backend/database — Vite + React + TypeScript, react-router-dom, @tanstack/react-query, axios, recharts. Đăng nhập bằng tài khoản username/password riêng (102 xã/phường) thay vì OTP. Vẫn giữ song song, không bắt buộc sau khi `mobile-app-officer` đạt parity.
- **AI hỗ trợ (tùy chọn, opt-in):** [Ollama](https://ollama.com) chạy local — tóm tắt tin MXH, lọc liên quan, gộp trùng ngữ nghĩa, gợi ý phân loại tin báo, trợ lý tìm kiếm ngôn ngữ tự nhiên. Tắt hoàn toàn nếu không cấu hình `LLM_PROVIDER=ollama`.

## Cấu trúc

```
bao-tin/
├── backend/               API Node.js + Express + Prisma (PostgreSQL + PostGIS)
├── mobile-app-citizen/    App Flutter cho người dân — Báo tin thường + nút Cấp cứu
├── mobile-app-officer/    App Flutter cho cán bộ phụ trách địa bàn — xác minh tin báo
├── dashboard-web/         App Flutter Web — dashboard trung tâm điều hành (admin/senior_officer)
├── dashboard-web-react/   Phiên bản React của dashboard-web — đăng nhập username/password
├── infra/                 docker-compose (PostgreSQL+PostGIS, MinIO)
└── data/raw/              Dữ liệu nguồn thô (Daklak.geojson — ranh giới hành chính thật)
```

## Setup — Backend

```bash
cd backend
npm install
npm run gen:keys        # sinh keypair RS256 dev (backend/keys/*.pem, gitignored)
cp ../infra/.env.example .env   # rồi điền giá trị thật (không commit .env)
```

```bash
npx tsc --noEmit         # kiểm tra type
npx vitest run           # 735+ test: crypto, validation, geo-matching, auth/report/officer/
                          # camera/dashboard/signals/search/web-account/wanted-notice/traffic-
                          # accident service logic + HTTP wiring + seed-data specs
```

Đầy đủ (cần Docker): `docker compose -f infra/docker-compose.yml up -d` → `cd backend && npx prisma db push && npm run seed` → chạy lại `npx vitest run` để test chạm DB/MinIO thật. Seed cũng in ra danh sách tài khoản username/password tạm cho 102 xã (`dashboard-web-react`).

Bật AI hỗ trợ (tùy chọn): cài [Ollama](https://ollama.com), `ollama pull qwen2.5:1.5b`, set `LLM_PROVIDER=ollama` trong `.env`.

## Mobile & Web

```bash
cd mobile-app-citizen && flutter analyze && flutter test
cd mobile-app-officer && flutter analyze && flutter test
cd dashboard-web && flutter analyze && flutter test
```

Máy giả lập Android hoặc thiết bị thật để `flutter run` 2 app mobile; `dashboard-web` chạy
trực tiếp trên Chrome (`flutter run -d chrome`), không cần giả lập. Chạy `mobile-app-citizen`/
`mobile-app-officer` trên Chrome (`flutter run -d chrome`) cũng dùng được để soi UI nhanh —
chỉ cần trỏ đúng backend qua `--dart-define=API_BASE_URL=http://localhost:3000` (mặc định
`10.0.2.2:3000` chỉ dùng được cho Android emulator).

```bash
cd dashboard-web-react && npm install && npm run typecheck && npm run test
npm run dev   # http://localhost:5173, cần backend đang chạy
```

## Đã xây dựng gì — theo phiên bản

| Version | Nội dung |
|---|---|
| **v1.0** | Lõi hệ thống — Auth OTP + JWT RS256/refresh rotation, báo tin thường (giữ EXIF GPS) + báo tin khẩn cấp (SOS), geo-matching PostGIS thật (102 xã/phường Đắk Lắk), app cán bộ xác minh trạng thái + audit log, ẩn danh tính khi cần |
| **v1.1** | Module camera an ninh — tự động khoanh vùng camera gần hiện trường, cán bộ tạo yêu cầu trích xuất hành chính (không xem/tải video) |
| **v1.2** | `dashboard-web` — KPI, biểu đồ, tab Tin báo xem/duyệt trực tiếp |
| **v1.3** | Kênh tình báo mở — bảng `social_media_signals` tách biệt hoàn toàn khỏi `reports`, crawler RSS thật (VnExpress/Tuổi Trẻ, chạy script riêng, không tự khởi động cùng server), lọc từ khóa địa danh + loại vụ việc, tóm tắt AI tùy chọn, gộp tin trùng |
| **v1.4** | Bản đồ cảnh báo khu vực (tổng hợp, không chi tiết từng tin), danh bạ khẩn cấp tự động theo vị trí, API liên kết ngược sang hệ thống tin bài chính |
| **v1.5** | NFC CCCD (mock UI, chưa tích hợp SDK thật), độ nóng tín hiệu MXH, đối chiếu chéo MXH ↔ tin dân báo, gợi ý gửi tố cáo chính thức qua VNeID cho tin nghiêm trọng |
| **v1.6** | Thông báo 2 chiều khi cán bộ đổi trạng thái tin báo — dừng ở mức thông báo đơn giản, không phải chat |
| **v1.7** | Tích hợp Ollama (model AI chạy local, không cần API key) làm tùy chọn tóm tắt tin cho crawler |
| **v1.8** | 4 tính năng AI hỗ trợ dùng Ollama: lọc tín hiệu MXH liên quan, gộp trùng theo ngữ nghĩa, diễn giải độ nóng khu vực, gợi ý phân loại tin báo, trợ lý tìm kiếm ngôn ngữ tự nhiên trên dashboard — tất cả opt-in, chỉ gợi ý, không tự kết luận |
| **v1.9** | Yêu cầu trích xuất nhiều camera theo tuyến đường (chọn nhiều camera, gộp 1 hành động gửi) phân tích phương hướng và vẽ đường chạy|
| **v1.10** | `dashboard-web-react` — phiên bản React song song của web quản lý, đăng nhập username/password riêng cho 102 xã (bảng `web_accounts` tách biệt khỏi `officers`), tự đổi thông tin/mật khẩu, admin quản lý/reset tài khoản |
| **v1.11** | CI/CD lên VPS Windows/IIS (self-hosted runner) + đường dự phòng Docker/Linux; trang chọn vai trò tĩnh ở site root trỏ `/admin`·`/citizen`·`/officer`; redesign toàn bộ UI `dashboard-web-react` bằng design token thật + role-gated nav; `mobile-app-citizen` build được cho Flutter Web (đổi `native_exif` sang package `exif` thuần Dart); vá 3 lỗ hổng bảo mật (rate-limit `/auth/refresh`, bắt buộc `OTP_HASH_PEPPER` ở production, audit log hành động admin trên tài khoản web) |
| **v1.12** | Đăng ký/đăng nhập bằng username/password song song với OTP (citizen active ngay, officer cần admin duyệt + gán địa bàn); dashboard thống kê admin (biểu đồ phân loại, xếp hạng địa bàn, bản đồ, xu hướng theo ngày/tuần/tháng, xuất PDF) trên cả web và app cán bộ; đổi logo chính thức toàn hệ thống; tách rõ 3 loại lỗi đăng nhập (mất mạng/giới hạn thử lại/sai thật) thay vì gộp chung "sai mật khẩu"; vá lỗi bản APK release thiếu quyền `INTERNET` (chỉ có ở biến thể debug, khiến app không kết nối được mạng khi cài thật); tab "Cảnh báo tai nạn giao thông" cho app cán bộ — nhận cảnh báo từ 1 bộ phát hiện đối tượng (YOLO) + OCR biển số riêng biệt, **không** nhận diện khuôn mặt hay theo dõi người xuyên camera, mọi cảnh báo đều cần cán bộ xác nhận thủ công |
| **v1.13** | Trang tin tức trong app (RSS bocongan.gov.vn) cho cả `mobile-app-citizen` và `mobile-app-officer`; thay biểu đồ tự vẽ bằng `fl_chart` (pie + line có tooltip) trong tab Thống kê của app cán bộ; viết lại thanh điều hướng dưới của `mobile-app-citizen` dùng đúng slot `bottomNavigationBar` (sửa lỗi giật khi bật/tắt bàn phím) và polish thanh điều hướng app cán bộ; thêm index còn thiếu (bao gồm GiST cho 3 cột PostGIS) sau khi rà lại hiệu năng backend |
| **v1.14** | Phân trang thật cho danh sách tin báo của app cán bộ (trước đây không giới hạn, tải hết rồi sắp xếp ở client) — thứ tự ưu tiên (khẩn cấp trước) đẩy xuống DB để phân trang không làm tin khẩn cấp bị "chôn" ở trang sau; tab Thống kê đổi sang endpoint tổng hợp riêng thay vì tải hết tin rồi đếm ở client; tin khẩn cấp (SOS) giờ cũng đẩy thông báo tới admin, không chỉ cán bộ phụ trách địa bàn; vá lỗi giới hạn đăng nhập officer chỉ tính theo IP (nhiều cán bộ cùng mạng cơ quan có thể tự khóa lẫn nhau) — nay tính theo IP + số điện thoại đúng yêu cầu SECURITY.md |
| **v1.15** | Tự động khóa tài khoản dân báo tin sau khi có 4 tin bị cán bộ xác nhận là sai (vẫn human-in-the-loop — hệ thống chỉ đếm các xác nhận officer đã tự đưa ra, không tự kết luận tin nào sai) — tài khoản bị khóa vẫn gửi được báo tin khẩn cấp (SOS) bình thường, chỉ chặn báo tin thường; hiện chưa có API/UI mở khóa, cần sửa trực tiếp DB |
| **v1.16** | Tab "TK bị khóa" mới cho admin trong app cán bộ — xem danh sách tài khoản dân bị tự động khóa (kèm số tin báo bị xác nhận sai) và mở khóa trực tiếp, không cần sửa DB nữa |
| **v1.17** | Gộp 3 tab admin-only (Thống kê, Duyệt TK, TK bị khóa) vào 1 mục "Quản trị" trong app cán bộ — bottom nav từ 10 tab rút còn 8, không đổi màu sắc/giao diện; thêm chức năng đổi mật khẩu tự phục vụ cho mọi tài khoản cán bộ (không chỉ admin) |
| **v1.18** | Thêm chức năng đổi mật khẩu tự phục vụ cho app người dân (mục "Hồ sơ") — cùng cơ chế với officer ở v1.17, hoạt động cả với tài khoản đang bị khóa do báo tin sai (khóa chỉ chặn gửi tin thường, không chặn quản lý tài khoản) |
| **v1.19** | Chat nội bộ liên đơn vị cho cán bộ — kênh chung toàn hệ thống + kênh riêng từng đơn vị (không phải chat với dân, vẫn dừng ở thông báo 1 chiều như v1.6 cho phía người dân) |
| **v1.20** | Gộp trang quản lý admin vào `mobile-app-officer`: port Trợ lý tìm kiếm (AI cục bộ) và Quản lý tài khoản (102 xã, `web_accounts`) sang app cán bộ, hỗ trợ đăng nhập cả 3 loại tài khoản (OTP/tự đăng ký/admin cấp sẵn) — admin không còn bắt buộc dùng `dashboard-web-react`; vá lỗi layout Row bị vỡ do `FilledButtonTheme`/`OutlinedButtonTheme` ép chiều rộng nút tối thiểu = vô hạn (dùng cho nút full-width như "Đăng nhập") khi đặt cạnh ô nhập trong cùng hàng |
| **v1.21** | Dữ liệu demo mới: 8 tài khoản cán bộ hoạt động + 4 tài khoản chờ duyệt trải khắp vùng Phú Yên cũ (sáp nhập vào Đắk Lắk 2025) để demo geo-matching/duyệt tài khoản toàn tỉnh; 5 tin cảnh báo tai nạn giao thông demo (đủ 3 trạng thái); 1 tài khoản dân demo bị khóa tự động sau 4 tin báo sai — đi qua đúng luồng thật (reportLifecycle + auto-lock), không chèn thẳng vào DB |
| **v1.22** | Thêm sửa (thay ảnh) và xóa cho "Lệnh truy nã" (trước chỉ đăng được, không sửa/xóa được) — admin-only, tự dọn ảnh cũ khỏi MinIO khi thay/xóa |

## Những gì còn thiếu / cố ý chưa làm

- Chưa nối nhà cung cấp SMS/push/Zalo OA thật — notification hiện chỉ log ra console.
- Crawler MXH (Facebook/Zalo) chưa làm — rủi ro vi phạm điều khoản dịch vụ nếu scrape ngoài API chính thức.
- Chưa đồng bộ danh mục địa bàn giữa Báo Tin và hệ thống tin bài chính.
- Số điện thoại khẩn cấp theo địa bàn cụ thể hiện là dữ liệu `[DEMO]`, chưa xác minh số thật.
- NFC CCCD mới dừng ở mock UI, chưa tích hợp VNeID/SDK chính thức.
- Chat/nhắn tin 2 chiều đầy đủ giữa dân và cán bộ — cố ý không làm.
- Độ chính xác của các tính năng AI (Ollama) phụ thuộc model — model nhỏ có thể đánh giá sai đôi lúc, cần cân nhắc model lớn hơn nếu dùng nghiêm túc ngoài mục đích demo.
- **`dashboard-web-react` chưa được kiểm tra bằng trình duyệt thật** — đã xác minh qua 30 test Vitest + toàn bộ luồng API sống qua curl, nhưng môi trường phát triển hiện tại không có công cụ tự động hoá trình duyệt để quan sát trực tiếp giao diện.

## Người đóng góp

- **[anhtaictv](https://github.com/anhtaictv)** — tác giả & phụ trách dự án
