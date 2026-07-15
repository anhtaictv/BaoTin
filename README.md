# 🛡️ Báo Tin

**Hệ thống tiếp nhận & xử lý tin báo an ninh trật tự cấp cơ sở**

Kênh phản ứng nhanh cho người dân báo tin trực tiếp tới cán bộ phụ trách địa bàn — định
tuyến tức thời theo vị trí GPS, rút ngắn thời gian xác minh so với các kênh hành chính
thông thường.

`Phiên bản hiện tại: 1.2` · xem lịch sử đầy đủ ở [`CHANGELOG.md`](CHANGELOG.md)

---

## Giới thiệu (About)

**Báo Tin** là phần mềm **độc lập** — không phải module của hệ thống quản lý tin bài hiện
có, dù có liên kết API hai chiều. Mục đích duy nhất: khi có sự việc xảy ra, người dân báo
tin **kèm định vị GPS thật** (ảnh chụp/quay giữ nguyên EXIF, không qua trung gian Zalo/
Messenger), hệ thống tự động khoanh vùng địa bàn (PostGIS geo-matching) và đẩy thông báo
tới đúng cán bộ phụ trách xã/phường đó — không cần chờ quy trình hành chính nhiều bước.

**Định vị:** bổ trợ VNeID, không thay thế. VNeID là kênh tố cáo chính thức có giá trị pháp
lý; Báo Tin là phản ứng tức thời, tại chỗ, cấp cơ sở.

**Ba nguyên tắc không thể vi phạm** (chi tiết ở [`CLAUDE.md`](CLAUDE.md)):
1. Tin từ mạng xã hội/báo chí **không bao giờ** hiển thị lẫn hoặc gắn nhãn giống tin dân
   báo đã xác thực — luôn tách UI, luôn gắn nhãn nguồn + độ tin cậy.
2. **Không có workflow nào tự động** kết luận đúng/sai hay tự đẩy tin sang hồ sơ chính
   thức — mọi tin đều cần cán bộ phụ trách địa bàn chọn trạng thái xác minh (human-in-the-loop).
3. Module camera an ninh chỉ định vị + tạo yêu cầu trích xuất hành chính — **không bao giờ
   xem/tải/phân tích video**, không nhận diện khuôn mặt hay đối tượng.

## Vì sao xây dựng dự án này

- **Tốc độ:** geo-matching PostGIS tự động thay vì cán bộ tự tra cứu địa bàn.
- **Toàn vẹn dữ liệu:** giữ nguyên EXIF GPS ảnh gốc — bằng chứng vị trí đáng tin cậy hơn ảnh
  qua các kênh nén/strip metadata.
- **Minh bạch trách nhiệm:** mọi thay đổi trạng thái tin báo đều có audit log, không có bước
  AI "tự quyết".
- **Bảo mật từ đầu:** mã hoá AES-256-GCM cho dữ liệu định danh, JWT RS256 + refresh rotation,
  rate-limit OTP — không phải hạng mục "làm sau khi có thời gian" (xem [`docs/SECURITY.md`](docs/SECURITY.md)).

## Cấu trúc

```
bao-tin/
├── backend/               API Node.js + Express + Prisma (PostgreSQL + PostGIS)
├── mobile-app-citizen/    App Flutter cho người dân — Báo tin thường + nút Cấp cứu
├── mobile-app-officer/    App Flutter cho cán bộ phụ trách địa bàn — xác minh tin báo
├── dashboard-web/         App Flutter Web — dashboard trung tâm điều hành (admin/senior_officer)
├── infra/                 docker-compose (PostgreSQL+PostGIS, MinIO)
├── data/raw/              Dữ liệu nguồn thô (Daklak.geojson — ranh giới hành chính thật)
├── docs/                  Tài liệu thiết kế + docs/adr/ (quyết định kiến trúc)
└── CONTEXT.md             Từ điển thuật ngữ dự án
```

## Setup — Backend

```bash
cd backend
npm install
npm run gen:keys        # sinh keypair RS256 dev (backend/keys/*.pem, gitignored)
cp ../infra/.env.example .env   # rồi điền giá trị thật (không commit .env)
```

Chạy được ngay không cần Docker/Postgres (đã xác nhận pass trên máy dev, không cần cài thêm gì):
```bash
npx tsc --noEmit         # kiểm tra type — sạch
npx vitest run           # 128 test pass: crypto (AES-GCM/OTP/blind-index/JWT), validation,
                          # geo-matching seed (đối chiếu 102 xã/phường thật), auth/report/
                          # officer/camera-extraction/dashboard-stats service logic + HTTP
                          # wiring qua fake Prisma
```

## Mobile & Web — đã xác nhận chạy được (Flutter 3.44.6)

Cả 3 app đã có platform tương ứng scaffold sẵn, quyền camera/vị trí đã thêm cho app dân, và đã pass thật:
```bash
cd mobile-app-citizen && flutter analyze && flutter test   # No issues found! / All tests passed!
cd mobile-app-officer && flutter analyze && flutter test   # No issues found! / All tests passed!
cd dashboard-web && flutter analyze && flutter test        # No issues found! / All tests passed!
                                                             # (3 test: render toàn bộ
                                                             # DashboardScreen với 4 biểu đồ
                                                             # fl_chart, + tab Tin báo — chọn
                                                             # 1 tin và duyệt trạng thái —
                                                             # bằng dữ liệu giả lập)
```
Chi tiết cách chạy (`flutter run --dart-define=...`) và ghi chú `dependency_overrides` (né 1 lỗi
native-assets `objective_c` trên Windows, không liên quan code app) ở README riêng của từng app.

## Setup đầy đủ (cần cài thêm công cụ)

1. **Docker Desktop** → `docker compose -f infra/docker-compose.yml up -d` → `cd backend && npx prisma migrate dev && npm run seed` → chạy lại `npx vitest run` để test chạm DB/MinIO thật (geo-matching với polygon Đắk Lắk thật, upload MinIO, seed 102 xã/phường — **mỗi xã/phường đều có ít nhất 1 cán bộ demo** để nhận thông báo tin báo geo-matching tới — + 1 tài khoản admin + 3 camera demo).
2. Máy giả lập Android (Android Studio đã có sẵn trên máy này) hoặc thiết bị thật để `flutter run` 2 app mobile; `dashboard-web` chạy trực tiếp trên Chrome (`flutter run -d chrome`), không cần giả lập. `flutter analyze`/`flutter test` không cần thiết bị cho cả 3.

## API đã có

**Giai đoạn 1:**
- `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/officer/login` (dual-mode), `/auth/refresh`, `/auth/sessions/revoke-all`
- `POST /reports`, `POST /reports/emergency`, `GET /reports/mine`, `GET /reports/:id/status`
- `GET /officer/reports`, `GET /officer/reports/:id`, `PATCH /officer/reports/:id/status`

**v1.1 — module camera an ninh:**
- `GET /officer/reports/:id/nearby-cameras?radius_m=` — tự động khoanh vùng camera gần tin báo, không cần tìm kiếm thủ công
- `POST /officer/reports/:id/camera-extraction-requests`, `GET /officer/reports/:id/camera-extraction-requests` — chỉ tạo/xem yêu cầu hành chính, hệ thống không bao giờ xem/tải/phân tích video (CLAUDE.md nguyên tắc #8)

**v1.2 — dashboard trung tâm điều hành (chỉ `admin`/`senior_officer`):**
- `GET /admin/dashboard/overview`, `/response-time-by-district`, `/response-time-by-officer`, `/volume-trend`, `/camera-queue`, `/districts`
- Tab "Tin báo" trên `dashboard-web`: xem/duyệt tin báo trực tiếp (tái dùng `/officer/reports*` có sẵn, không cần API mới), tự làm mới 20s để tin mới từ dân gửi lên hiện ra ngay

Chi tiết đầy đủ ở [`docs/API_SPEC.md`](docs/API_SPEC.md).

## Trạng thái hiện tại

Xem [`docs/ROADMAP.md`](docs/ROADMAP.md) + [`CHANGELOG.md`](CHANGELOG.md). Dữ liệu địa bàn dùng ranh giới thật (Đắk Lắk, `data/raw/Daklak.geojson`, 102 xã/phường); danh sách cán bộ (phủ đủ 102/102 xã/phường + 1 admin) và camera (3) là dữ liệu demo (`[DEMO]`), chưa phải dữ liệu thật. Giai đoạn 2 (crawler MXH/báo chí) chưa làm — bảng `social_media_signals` đã có sẵn trong schema nhưng chưa có logic crawl.

## Lịch sử phiên bản

| Phiên bản | Nội dung chính |
|---|---|
| **1.2** | Dashboard trung tâm điều hành (`dashboard-web`) — KPI, biểu đồ, tab Tin báo xem/duyệt trực tiếp; phủ đủ cán bộ demo cho 102/102 xã/phường |
| **1.1** | Module camera an ninh — gợi ý camera gần hiện trường + yêu cầu trích xuất hành chính (không xem/tải video) |
| **1.0** | Giai đoạn 1 lõi — auth OTP/JWT, báo tin + cấp cứu, geo-matching PostGIS thật, app cán bộ xác minh tin |

Chi tiết từng dòng thay đổi: [`CHANGELOG.md`](CHANGELOG.md).

## Người đóng góp (Contributors)

- **[anhtaictv](https://github.com/anhtaictv)** — tác giả & phụ trách dự án
