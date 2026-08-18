<p align="center">
  <img src="landing/logo.png" alt="Báo Tin" width="120">
</p>

<h1 align="center">Báo Tin</h1>
<p align="center"><b>Hệ thống tiếp nhận &amp; xử lý tin báo an ninh trật tự cấp cơ sở</b></p>

<p align="center">
  <img alt="backend" src="https://img.shields.io/badge/backend-1.25.3-2563eb?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="dashboard-web-react" src="https://img.shields.io/badge/dashboard--web--react-0.6.0-2563eb?style=flat-square&logo=react&logoColor=white">
  <img alt="dashboard-web" src="https://img.shields.io/badge/dashboard--web-1.7.0%2B7-2563eb?style=flat-square&logo=flutter&logoColor=white">
  <img alt="mobile-app-officer" src="https://img.shields.io/badge/mobile--app--officer-1.16.0%2B24-2563eb?style=flat-square&logo=flutter&logoColor=white">
  <img alt="mobile-app-citizen" src="https://img.shields.io/badge/mobile--app--citizen-1.11.0%2B18-2563eb?style=flat-square&logo=flutter&logoColor=white">
</p>
<p align="center">
  <img alt="PostgreSQL + PostGIS" src="https://img.shields.io/badge/PostgreSQL_+_PostGIS-336791?style=flat-square&logo=postgresql&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Flutter" src="https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white">
  <img alt="backend tests" src="https://img.shields.io/badge/backend_tests-824_passing-16a34a?style=flat-square&logo=vitest&logoColor=white">
  <img alt="human-in-the-loop" src="https://img.shields.io/badge/x%C3%A1c_minh-human--in--the--loop-dc2626?style=flat-square">
</p>

<p align="center">
  Kênh phản ứng nhanh cho người dân báo tin trực tiếp tới cán bộ phụ trách địa bàn —<br/>
  định tuyến tức thời theo vị trí GPS, rút ngắn thời gian xác minh so với kênh hành chính thông thường.
</p>

> Tài liệu thiết kế đầy đủ (`SECURITY.md`, `ARCHITECTURE.md`, `API_SPEC.md`, `DATABASE_SCHEMA.md`,
> `ROADMAP.md`, `CHANGELOG.md`, ADR...) được lưu cục bộ trên máy phát triển, không publish lên
> remote — chỉ `README.md` này và [`CLAUDE.md`](CLAUDE.md) (quy tắc thiết kế bắt buộc) được đưa
> lên, đủ để ai đọc từ remote cũng nắm được bức tranh tổng thể.

---

## Mục lục

- [Vì sao có Báo Tin](#vì-sao-có-báo-tin)
- [Nguyên tắc thiết kế bắt buộc](#nguyên-tắc-thiết-kế-bắt-buộc)
- [Kiến trúc và tech stack](#kiến-trúc-và-tech-stack)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Tính năng chính](#tính-năng-chính)
- [Trạng thái và việc còn thiếu](#trạng-thái-và-việc-còn-thiếu)
- [Lịch sử phiên bản](#lịch-sử-phiên-bản)
- [Người đóng góp](#người-đóng-góp)

---

## Vì sao có Báo Tin

Khi có sự việc xảy ra ngoài đời, kênh báo tin hành chính thông thường (kể cả VNeID) đúng nhưng
chậm — nhiều bước, không định vị được ngay tin đó thuộc địa bàn nào, không tự động tới đúng
người phụ trách. **Báo Tin** thu hẹp khoảng đó ở lớp phản ứng đầu tiên: người dân báo tin **kèm
định vị GPS thật** (chụp/chọn ảnh trực tiếp trong app, giữ nguyên EXIF — không qua trung gian
Zalo/Messenger vì các nền tảng đó thường xóa EXIF), hệ thống dùng PostGIS khoanh vùng địa bàn
ngay lập tức và đẩy thẳng tới cán bộ phụ trách xã/phường đó, không cần chờ luân chuyển qua
nhiều cấp.

Mọi tin đều đi qua một cán bộ con người trước khi trở thành "đã xác thực" — không có bước AI nào
tự kết luận đúng/sai. Tín hiệu từ mạng xã hội/báo chí được xử lý và hiển thị hoàn toàn tách biệt
khỏi tin dân báo, không bao giờ trộn lẫn hay tự động nâng cấp thành hồ sơ chính thức.

**Định vị:** bổ trợ VNeID, không thay thế. VNeID là kênh tố cáo chính thức có giá trị pháp lý;
Báo Tin là phản ứng tức thời, tại chỗ, cấp cơ sở.

## Nguyên tắc thiết kế bắt buộc

Chi tiết đầy đủ ở [`CLAUDE.md`](CLAUDE.md) — đây là quy tắc bắt buộc, không phải gợi ý:

| # | Nguyên tắc |
|---|---|
| 1 | Tin từ mạng xã hội/báo chí **không bao giờ** hiển thị lẫn hoặc gắn nhãn giống tin dân báo đã xác thực — luôn tách UI, luôn gắn nhãn nguồn + độ tin cậy. |
| 2 | **Không workflow nào tự động** kết luận đúng/sai hay đẩy tin sang hồ sơ chính thức — mọi tin cần cán bộ phụ trách địa bàn chọn trạng thái xác minh (human-in-the-loop). |
| 3 | Không crawl trực tiếp khi demo — module crawler dùng seed data mẫu, crawler thật chạy tách biệt qua script riêng. |
| 4 | Không tự viết code đọc chip NFC CCCD — chỉ mock UI, tích hợp thật phải qua VNeID/SDK chính thức của Bộ Công an. |
| 5 | Giữ nguyên EXIF GPS ảnh gốc — người dân phải chụp/chọn ảnh trực tiếp trong app. |
| 6 | Bảo mật là yêu cầu từ đầu — mã hoá AES-256-GCM cho dữ liệu định danh, JWT RS256 + refresh rotation, rate-limit OTP, không phải hạng mục "làm sau khi có thời gian". |
| 7 | Tính năng AI hỗ trợ **chỉ gợi ý**, không có bước nào tự động kết luận thay con người. |

## Kiến trúc và tech stack

| Lớp | Công nghệ |
|---|---|
| Database | PostgreSQL + PostGIS |
| Object storage | MinIO (chỉ lưu path trong Postgres) |
| Cache | Redis — tùy chọn, dùng cho geo-matching, fail-open nếu Redis chưa chạy/chết |
| Backend | Node.js + TypeScript + Express, Prisma ORM, Zod, JWT RS256 + refresh rotation, vitest |
| `mobile-app-citizen` | Flutter — người dân: báo tin + nút Cấp cứu, dark mode theo hệ thống, offline queue khi mất mạng |
| `mobile-app-officer` | Flutter — cán bộ phụ trách địa bàn **và** admin/senior_officer (từ v1.20: gộp đủ màn quản trị — thống kê, duyệt/quản lý tài khoản, trợ lý tìm kiếm, chat liên đơn vị), dark mode theo hệ thống |
| `dashboard-web` | Flutter Web — bản dashboard cũ hơn, vẫn chạy song song, đã có dark mode từ trước |
| `dashboard-web-react` | Vite + React + TypeScript, react-router-dom, @tanstack/react-query, axios, recharts — đăng nhập username/password riêng cho 102 xã/phường, dark mode toggle thủ công, MFA/TOTP |
| AI hỗ trợ (opt-in) | [Ollama](https://ollama.com) local, hoặc bất kỳ endpoint OpenAI-compatible (`LLM_PROVIDER=openai` + `OPENAI_BASE_URL`, ví dụ NVIDIA NIM) — tóm tắt tin, lọc liên quan, gộp trùng, gợi ý phân loại, trợ lý tìm kiếm ngôn ngữ tự nhiên, diễn giải câu hỏi tra cứu luật thành điều/khoản/từ khóa. Tắt hoàn toàn nếu `LLM_PROVIDER=none`. |

Mobile/web dùng chung 1 backend, versioned độc lập với nhau.

## Cấu trúc thư mục

```
bao-tin/
├── backend/               API Node.js + Express + Prisma (PostgreSQL + PostGIS)
├── mobile-app-citizen/    App Flutter cho người dân — Báo tin thường + nút Cấp cứu
├── mobile-app-officer/    App Flutter cho cán bộ phụ trách địa bàn — xác minh tin báo
├── dashboard-web/         App Flutter Web — dashboard trung tâm điều hành (admin/senior_officer)
├── dashboard-web-react/   Phiên bản React của dashboard-web — đăng nhập username/password
├── infra/                 docker-compose (PostgreSQL+PostGIS, MinIO, Redis)
└── data/raw/              Dữ liệu nguồn thô (Daklak.geojson — ranh giới hành chính thật)
```

## Bắt đầu nhanh

### Backend

```bash
cd backend
npm install
npm run gen:keys                       # sinh keypair RS256 dev (backend/keys/*.pem, gitignored)
cp ../infra/.env.example .env          # rồi điền giá trị thật (không commit .env)

npx tsc --noEmit                       # kiểm tra type
npx vitest run                         # 824 test: crypto, validation, geo-matching, auth/report/
                                        # officer/camera (hướng + facesLocation + CRUD admin)/
                                        # dashboard/signals/search/web-account/wanted-notice/
                                        # traffic-accident/legal-lookup/broadcast-alert
                                        # + HTTP wiring + seed specs
```

Đầy đủ (cần Docker):

```bash
docker compose -f infra/docker-compose.yml up -d
cd backend && npx prisma db push && npm run seed
npx vitest run   # test chạm DB/MinIO thật
```

Seed cũng in ra danh sách tài khoản username/password tạm cho 102 xã (`dashboard-web-react`).

Bật AI hỗ trợ (tùy chọn): cài [Ollama](https://ollama.com), `ollama pull qwen2.5:1.5b`, set
`LLM_PROVIDER=ollama` trong `.env`.

### Mobile (Flutter)

```bash
cd mobile-app-citizen && flutter analyze && flutter test
cd mobile-app-officer && flutter analyze && flutter test
cd dashboard-web        && flutter analyze && flutter test
```

Cần máy giả lập Android/thiết bị thật để `flutter run` 2 app mobile; `dashboard-web` chạy trực
tiếp trên Chrome (`flutter run -d chrome`), không cần giả lập. Chạy `mobile-app-citizen`/
`mobile-app-officer` trên Chrome cũng dùng được để soi UI nhanh — trỏ đúng backend qua
`--dart-define=API_BASE_URL=http://localhost:3000` (mặc định `10.0.2.2:3000` chỉ dùng được cho
Android emulator).

### Dashboard web (React)

```bash
cd dashboard-web-react
npm install && npm run typecheck && npm run test
npm run dev   # http://localhost:5173, cần backend đang chạy
```

## Tính năng chính

<table>
<tr>
<td width="50%">

### 📨 Báo tin & xác minh
- Báo tin thường (giữ EXIF GPS) + SOS khẩn cấp — geo-matching PostGIS thật, định tuyến ngay tới
  cán bộ phụ trách địa bàn
- Xác minh bắt buộc qua cán bộ (**human-in-the-loop**), audit log mọi hành động nhạy cảm
- Trạng thái 5 mức: Mới gửi / Đã định tuyến / Đang xác minh / Đã xử lý / Tin giả-Hủy
- Cảnh báo theo địa bàn (**geo-fence broadcast**) — officer gửi hàng loạt tới dân trong địa bàn
  được phân công, push chia batch, không chặn request nếu 1 lượt lỗi

</td>
<td width="50%">

### 🧩 Module chuyên biệt
- Kênh tình báo mở (crawler RSS + AI tùy chọn) — tách biệt hoàn toàn khỏi tin dân báo
- Camera an ninh — yêu cầu trích xuất hành chính, **không xem/tải video**; trang bản đồ camera
  toàn địa bàn kèm hướng/góc nhìn (hình quạt), tự động lọc ra camera nào *thực sự hướng về* hiện
  trường (không chỉ ở gần) qua bearing PostGIS; admin/senior_officer thêm/sửa/xoá camera
- Cảnh báo tai nạn giao thông — YOLO + OCR biển số, **không nhận diện khuôn mặt**
- "Lệnh truy nã", chat nội bộ liên đơn vị
- Tra cứu văn bản luật (Bộ luật Hình sự, Dân sự) — AI chỉ diễn giải câu hỏi, câu trả lời luôn
  nguyên văn thật từ corpus đã nạp

</td>
</tr>
<tr>
<td width="50%">

### 🔐 Xác thực & bảo mật
- OTP + JWT RS256/refresh rotation cho công dân; username/password + MFA/TOTP cho officer/admin
- Mã hoá **AES-256-GCM** dữ liệu định danh, rate-limit + account lockout, RBAC theo `district_id`
- Push notification qua Firebase Cloud Messaging (fallback console nếu chưa cấu hình)
- Endpoint quản trị camera (thêm/sửa/xoá) tách role riêng, chặt hơn role đọc thông thường; mọi
  thao tác ghi đều validate khoá ngoại tồn tại trước khi ghi DB — không để lộ lỗi ràng buộc dữ
  liệu thô ra ngoài thành lỗi hệ thống chung chung

</td>
<td width="50%">

### ⚙️ Vận hành
- CI/CD lên VPS Windows/IIS (self-hosted runner) + đường dự phòng Docker/Linux
- Redis cache cho dữ liệu ít đổi (fail-open), dark mode toàn bộ 4 app/web
- Offline queue `mobile-app-citizen`: `clientRequestId` chống trùng report khi retry,
  `flutter_secure_storage`, background sync thật qua `workmanager`

</td>
</tr>
</table>

<!-- Ảnh chụp màn hình thật của app (citizen/officer/dashboard) chèn vào đây khi có -->

## Trạng thái và việc còn thiếu

| Mục | Trạng thái |
|---|---|
| Push notification (FCM) | Backend xong — cần tạo service account Firebase thật (`FCM_PROJECT_ID`/`FCM_CLIENT_EMAIL`/`FCM_PRIVATE_KEY`) để kích hoạt; chưa có key thì fallback console như cũ. SMS/Zalo OA chưa làm. |
| MFA/TOTP officer/admin | Backend xong — `dashboard-web-react` và app cán bộ chưa có UI để tự bật/quét QR/nhập mã. |
| Crawler MXH (Facebook/Zalo) | Chưa làm — rủi ro vi phạm điều khoản dịch vụ nếu scrape ngoài API chính thức. |
| Đồng bộ ranh giới địa bàn | Chưa đồng bộ với hệ thống tin bài chính. |
| Số điện thoại khẩn cấp | Dữ liệu `[DEMO]` theo địa bàn, chưa xác minh số thật. |
| NFC CCCD | Mock UI, chưa tích hợp VNeID/SDK chính thức. |
| Chat 2 chiều dân ↔ cán bộ | Cố ý không làm — chỉ thông báo 1 chiều. |
| Certificate pinning mobile | Chưa làm — cần chốt domain/cert TLS thật đang deploy trước khi hardcode pin. |
| Độ chính xác AI (Ollama) | Phụ thuộc model — model nhỏ có thể đánh giá sai, cân nhắc model lớn hơn nếu dùng ngoài mục đích demo. |
| `dashboard-web-react` trên browser thật | Đã xác minh qua 33 test Vitest + luồng API sống qua curl, chưa quan sát trực tiếp UI vì môi trường dev hiện tại không có công cụ tự động hoá trình duyệt. |
| Tra cứu camera theo tuyến đường A→B thật | Chưa làm — cần road-matching/routing (vd. OSRM), hạ tầng hoàn toàn mới. Hiện chỉ có "toàn bộ camera trong địa bàn" + "camera trong bán kính quanh 1 tin báo". |
| Quản lý camera (thêm/sửa/xoá) trên mobile | Cố ý chỉ làm ở `dashboard-web-react` — theo đúng tiền lệ quản lý tài khoản (cũng chỉ có ở web), không phải việc officer làm ngoài hiện trường. |

## Lịch sử phiên bản

**Gần đây nhất:**

| Version | Nội dung |
|---|---|
| **v1.25** | Camera an ninh có hướng/góc nhìn — `Camera.directionDegrees`/`fovDegrees`, `facesLocation` (đúng/sai/chưa rõ) tính bằng bearing PostGIS thật (`ST_Azimuth`) chứ không chỉ khoảng cách; trang "Camera" độc lập vẽ hình quạt hướng trên `dashboard-web-react`, overlay "Hiện camera" trên tab Địa điểm của `mobile-app-officer`; admin/senior_officer thêm/sửa/xoá camera (web-only, chọn toạ độ bằng click bản đồ hoặc nhập tay); vá lỗi validate khoá ngoại `districtId` (tránh lộ lỗi DB thô ra ngoài); **[1.25.1]** vá 2 lỗi khiến tra cứu văn bản luật không dùng được trên production — role DB runtime (`baotin_app`) thiếu quyền trên schema `public` (nay GRANT qua Prisma migration, tự áp trên mọi môi trường thay vì script init 1 lần); pipeline deploy chưa từng đưa corpus PDF luật lên VPS nên chưa import được (nay copy PDF + workflow import riêng); **[1.25.2]** vá SOS emergency response — tách biệt xử lý SOS khỏi latency push notification, đảm bảo SOS luôn phản hồi tức thời; **[1.25.3]** security: fix glob@10.5.0 vulnerability via npm audit |
| **v1.24** | Trạng thái tin báo chia 5 mức (Mới gửi/Đã định tuyến/Đang xác minh/Đã xử lý/Tin giả-Hủy); cảnh báo theo địa bàn (geo-fence broadcast) cho officer gửi hàng loạt tới dân; offline sync hardening cho `mobile-app-citizen` (`clientRequestId` chống trùng, `flutter_secure_storage`, background sync qua `workmanager`); tra cứu văn bản luật/quy định bằng AI local (Ollama) trên cả 4 app/web — câu trả lời luôn nguyên văn từ corpus PDF thật, AI chỉ diễn giải câu hỏi; vá lỗi bản đồ 403 do `Referrer-Policy` chặn OSM tile server |
| **v1.23** | Push notification FCM thật; Redis cache geo-matching; MFA/TOTP + password policy 12 ký tự + session riêng cho officer/admin; dark mode 4 app; offline queue cho `mobile-app-citizen`; AI provider mở rộng (OpenAI-compatible bất kỳ); vá lỗ hổng dependency mức high (`sharp`, `fast-xml-parser`); scaffold ký release Android thật; **[1.23.1]** audit bảo mật toàn hệ thống — vá lỗi `trust proxy` làm rate-limit SOS bị gộp chung, transaction report+attachment, index/unique constraint DB, validate link mobile |
| **v1.22** | Sửa (thay ảnh) và xóa cho "Lệnh truy nã" — admin-only, tự dọn ảnh cũ khỏi MinIO |
| **v1.21** | Dữ liệu demo mới trải khắp vùng Phú Yên cũ (sáp nhập Đắk Lắk 2025) để demo geo-matching/duyệt tài khoản toàn tỉnh |
| **v1.20** | Gộp trang quản lý admin vào `mobile-app-officer` (Trợ lý tìm kiếm + Quản lý tài khoản) — admin không còn bắt buộc dùng `dashboard-web-react` |

<details>
<summary><b>Toàn bộ lịch sử từ v1.0</b> (bấm để xem)</summary>

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
| **v1.9** | Yêu cầu trích xuất nhiều camera theo tuyến đường (chọn nhiều camera, gộp 1 hành động gửi) phân tích phương hướng và vẽ đường chạy |
| **v1.10** | `dashboard-web-react` — phiên bản React song song của web quản lý, đăng nhập username/password riêng cho 102 xã (bảng `web_accounts` tách biệt khỏi `officers`), tự đổi thông tin/mật khẩu, admin quản lý/reset tài khoản |
| **v1.11** | CI/CD lên VPS Windows/IIS (self-hosted runner) + đường dự phòng Docker/Linux; trang chọn vai trò tĩnh ở site root trỏ `/admin`·`/citizen`·`/officer`; redesign toàn bộ UI `dashboard-web-react` bằng design token thật + role-gated nav; `mobile-app-citizen` build được cho Flutter Web (đổi `native_exif` sang package `exif` thuần Dart); vá 3 lỗ hổng bảo mật (rate-limit `/auth/refresh`, bắt buộc `OTP_HASH_PEPPER` ở production, audit log hành động admin trên tài khoản web) |
| **v1.12** | Đăng ký/đăng nhập bằng username/password song song với OTP (citizen active ngay, officer cần admin duyệt + gán địa bàn); dashboard thống kê admin (biểu đồ phân loại, xếp hạng địa bàn, bản đồ, xu hướng theo ngày/tuần/tháng, xuất PDF) trên cả web và app cán bộ; đổi logo chính thức toàn hệ thống; tách rõ 3 loại lỗi đăng nhập (mất mạng/giới hạn thử lại/sai thật) thay vì gộp chung "sai mật khẩu"; vá lỗi bản APK release thiếu quyền `INTERNET`; tab "Cảnh báo tai nạn giao thông" cho app cán bộ — nhận cảnh báo từ 1 bộ phát hiện đối tượng (YOLO) + OCR biển số riêng biệt, **không** nhận diện khuôn mặt hay theo dõi người xuyên camera, mọi cảnh báo đều cần cán bộ xác nhận thủ công |
| **v1.13** | Trang tin tức trong app (RSS bocongan.gov.vn) cho cả `mobile-app-citizen` và `mobile-app-officer`; thay biểu đồ tự vẽ bằng `fl_chart` (pie + line có tooltip) trong tab Thống kê của app cán bộ; viết lại thanh điều hướng dưới của `mobile-app-citizen` dùng đúng slot `bottomNavigationBar`; thêm index còn thiếu (bao gồm GiST cho 3 cột PostGIS) sau khi rà lại hiệu năng backend |
| **v1.14** | Phân trang thật cho danh sách tin báo của app cán bộ; ưu tiên khẩn cấp đẩy xuống DB; tab Thống kê đổi sang endpoint tổng hợp riêng; SOS đẩy thông báo tới admin; vá lỗi giới hạn đăng nhập officer chỉ tính theo IP — nay tính theo IP + số điện thoại đúng SECURITY.md |
| **v1.15** | Tự động khóa tài khoản dân báo tin sau 4 tin bị cán bộ xác nhận là sai (vẫn human-in-the-loop) — tài khoản bị khóa vẫn gửi được SOS, chỉ chặn báo tin thường |
| **v1.16** | Tab "TK bị khóa" cho admin trong app cán bộ — xem + mở khóa trực tiếp, không cần sửa DB |
| **v1.17** | Gộp 3 tab admin-only vào 1 mục "Quản trị" trong app cán bộ; thêm đổi mật khẩu tự phục vụ cho mọi tài khoản cán bộ |
| **v1.18** | Đổi mật khẩu tự phục vụ cho app người dân — hoạt động cả với tài khoản đang bị khóa do báo tin sai |
| **v1.19** | Chat nội bộ liên đơn vị cho cán bộ — kênh chung toàn hệ thống + kênh riêng từng đơn vị |
| **v1.20** | Gộp trang quản lý admin vào `mobile-app-officer`: Trợ lý tìm kiếm (AI cục bộ) + Quản lý tài khoản (102 xã) sang app cán bộ, hỗ trợ đăng nhập cả 3 loại tài khoản |
| **v1.21** | Dữ liệu demo mới trải khắp vùng Phú Yên cũ (sáp nhập Đắk Lắk 2025); 5 tin cảnh báo tai nạn giao thông demo; 1 tài khoản dân demo bị khóa tự động, đi qua đúng luồng thật |
| **v1.22** | Sửa (thay ảnh) và xóa cho "Lệnh truy nã" — admin-only, tự dọn ảnh cũ khỏi MinIO khi thay/xóa |
| **v1.23** | Push notification FCM thật; Redis cache geo-matching (fail-open); MFA/TOTP + password policy 12 ký tự + session riêng cho officer/admin; dark mode theo hệ thống cho `mobile-app-citizen`/`mobile-app-officer`, toggle thủ công cho `dashboard-web-react`; offline queue cho `mobile-app-citizen`; AI provider mở rộng (OpenAI-compatible bất kỳ, không chỉ OpenAI/Gemini/Ollama); vá 2 lỗ hổng bảo mật high-severity (`sharp`, `fast-xml-parser`); scaffold ký release Android thật (minify/shrink + `key.properties`) |
| **v1.24** | Status badge tách "pending" thành Mới gửi/Đã định tuyến theo `assignedOfficerId`, đổi nhãn Đã xử lý/Tin giả-Hủy — wire xuyên 4 file theme + 7 màn danh sách/chi tiết tin báo (backend + citizen + officer + dashboard-web(-react)); geo-fence broadcast alert (`OfficerBroadcastAlert`, `POST /officer/broadcast-alerts`, mở rộng `GET /area-alerts`) cho officer gửi cảnh báo hàng loạt tới dân trong địa bàn được phân công; offline sync hardening cho `mobile-app-citizen` — `clientRequestId` idempotency chống trùng report khi retry, hàng đợi offline chuyển sang `flutter_secure_storage`, background sync thật qua `workmanager` (Android) / `BGTaskScheduler` (iOS); tra cứu văn bản luật/quy định bằng AI local (Ollama) — corpus PDF thật (Bộ luật Hình sự, Dân sự) nạp thủ công vào DB, AI chỉ diễn giải câu hỏi thành điều/khoản/từ khóa, câu trả lời luôn nguyên văn từ dữ liệu đã nạp, không do AI tự viết; vá lỗi bản đồ 403 do `Referrer-Policy: no-referrer` chặn Referer tới OSM tile server, đổi sang `strict-origin-when-cross-origin` |
| **v1.25** | Camera an ninh có hướng/góc nhìn: `Camera.directionDegrees`/`fovDegrees` (nullable, camera thật đăng ký sau vẫn hiển thị được), endpoint `GET/POST/PUT/DELETE /officer/cameras` (đọc mở cho mọi officer, ghi/xoá giới hạn admin/senior_officer); `facesLocation` tính bằng `ST_Azimuth` + hàm thuần `isFacingBearing` (xử lý đúng wraparound 0°/360°) để phân biệt "camera gần hiện trường" với "camera *thực sự nhìn thấy* hiện trường" — badge/hình quạt xanh (đúng hướng)/cam (sai hướng)/xanh dương (chưa rõ) ở cả widget cũ lẫn trang mới; trang "Camera" độc lập trên `dashboard-web-react` liệt kê + vẽ bản đồ toàn bộ camera trong địa bàn; `mobile-app-officer` thêm overlay "Hiện camera" trên tab Địa điểm sẵn có thay vì thêm tab bottom-nav thứ 10; form thêm/sửa/xoá camera cho admin/senior_officer (chỉ web, chọn toạ độ bằng click bản đồ hoặc nhập tay) — xoá chặn trước lỗi ràng buộc khoá ngoại (409 nếu camera còn yêu cầu trích xuất/cảnh báo tai nạn liên quan) thay vì để crash; vá lỗi thiếu validate `districtId` tồn tại thật trước khi ghi camera (tránh lộ lỗi ràng buộc DB thô thành lỗi hệ thống chung chung) |

</details>

## Người đóng góp

- **[anhtaictv](https://github.com/anhtaictv)** — tác giả & phụ trách dự án
