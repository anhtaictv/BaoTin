# 🛡️ Báo Tin

**Hệ thống tiếp nhận & xử lý tin báo an ninh trật tự cấp cơ sở**

Kênh phản ứng nhanh cho người dân báo tin trực tiếp tới cán bộ phụ trách địa bàn — định
tuyến tức thời theo vị trí GPS, rút ngắn thời gian xác minh so với các kênh hành chính
thông thường.

`Phiên bản hiện tại: backend 1.10.0 · dashboard-web-react 0.1.0 · dashboard-web 1.6.0+5 · mobile-app-officer 1.5.0+6 · mobile-app-citizen 1.5.0+7`

> Tài liệu thiết kế chi tiết (SECURITY.md, ARCHITECTURE.md, API_SPEC.md, DATABASE_SCHEMA.md,
> ROADMAP.md, CHANGELOG.md, ADR...) được lưu và duy trì cục bộ trên máy phát triển, không
> publish lên remote repo này — chỉ `README.md` và [`CLAUDE.md`](CLAUDE.md) (quy tắc thiết
> kế bắt buộc) được đưa lên. README này tóm tắt đủ để ai đọc từ remote cũng nắm được bức
> tranh tổng thể.

---

## Giới thiệu

**Báo Tin** là phần mềm được phát triển với mục đích duy nhất: khi có sự việc xảy ra, người dân báo
tin **kèm định vị GPS thật** (ảnh chụp/quay giữ nguyên EXIF, không qua trung gian Zalo/
Messenger), hệ thống tự động khoanh vùng địa bàn (PostGIS geo-matching) và đẩy thông báo
tới đúng cán bộ phụ trách xã/phường đó — không cần chờ quy trình hành chính nhiều bước.

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
7. Module camera an ninh chỉ định vị + tạo yêu cầu trích xuất hành chính — **không bao giờ
   xem/tải/phân tích video**, không nhận diện khuôn mặt hay đối tượng.
8. Các tính năng AI hỗ trợ (Ollama, xem mục bên dưới) **chỉ gợi ý**, không có bước nào tự
   động kết luận thay con người.

## Tech stack

- **Database:** PostgreSQL + PostGIS · **Object storage:** MinIO (chỉ lưu path trong Postgres)
- **Backend:** Node.js + TypeScript + Express, Prisma ORM, Zod, JWT RS256 + refresh rotation, vitest
- **3 app Flutter riêng biệt, versioned độc lập, dùng chung backend:** `mobile-app-citizen` (người dân), `mobile-app-officer` (cán bộ phụ trách địa bàn), `dashboard-web` (admin/senior_officer, chạy trình duyệt) — Riverpod, Dio, flutter_secure_storage, flutter_map/OpenStreetMap
- **`dashboard-web-react`:** phiên bản React song song của web quản lý, dùng chung backend/database — Vite + React + TypeScript, react-router-dom, @tanstack/react-query, axios, recharts. Đăng nhập bằng tài khoản username/password riêng (102 xã/phường) thay vì OTP.
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
npx vitest run           # 315+ test: crypto, validation, geo-matching, auth/report/officer/
                          # camera/dashboard/signals/search/web-account service logic + HTTP wiring
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
trực tiếp trên Chrome (`flutter run -d chrome`), không cần giả lập.

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
| **v1.9** | Yêu cầu trích xuất nhiều camera theo tuyến đường (chọn nhiều camera, gộp 1 hành động gửi) — vẫn là N yêu cầu hành chính độc lập, không có nhận diện/theo dõi qua camera |
| **v1.10** | `dashboard-web-react` — phiên bản React song song của web quản lý, đăng nhập username/password riêng cho 102 xã (bảng `web_accounts` tách biệt khỏi `officers`), tự đổi thông tin/mật khẩu, admin quản lý/reset tài khoản |

## Những gì còn thiếu / cố ý chưa làm

- Chưa nối nhà cung cấp SMS/push/Zalo OA thật — notification hiện chỉ log ra console.
- Crawler MXH (Facebook/Zalo) chưa làm — rủi ro vi phạm điều khoản dịch vụ nếu scrape ngoài API chính thức.
- Chưa đồng bộ danh mục địa bàn giữa Báo Tin và hệ thống tin bài chính.
- Số điện thoại khẩn cấp theo địa bàn cụ thể hiện là dữ liệu `[DEMO]`, chưa xác minh số thật.
- NFC CCCD mới dừng ở mock UI, chưa tích hợp VNeID/SDK chính thức.
- Chat/nhắn tin 2 chiều đầy đủ giữa dân và cán bộ — cố ý không làm.
- Độ chính xác của các tính năng AI (Ollama) phụ thuộc model — model nhỏ có thể đánh giá sai đôi lúc, cần cân nhắc model lớn hơn nếu dùng nghiêm túc ngoài mục đích demo.
- **Nhận diện/truy vết đối tượng qua nhiều camera** — cố ý không làm, kể cả khi được yêu cầu, vì là giám sát sinh trắc học cần cơ sở pháp lý riêng (CLAUDE.md #8, xem mục nguyên tắc thiết kế phía trên). Nếu đơn vị nghiệp vụ đã có hệ thống chuyên dụng riêng, có thể tích hợp qua API sau — chưa làm, cần thêm thông tin từ phía đó.
- **`dashboard-web-react` chưa được kiểm tra bằng trình duyệt thật** — đã xác minh qua 30 test Vitest + toàn bộ luồng API sống qua curl, nhưng môi trường phát triển hiện tại không có công cụ tự động hoá trình duyệt để quan sát trực tiếp giao diện.

## Người đóng góp

- **[anhtaictv](https://github.com/anhtaictv)** — tác giả & phụ trách dự án
