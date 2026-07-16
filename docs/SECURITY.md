# Security Requirements — Báo Tin

> Đây là hệ thống liên quan an ninh trật tự, chứa dữ liệu định danh công dân + vị trí + nội dung nhạy cảm. Bảo mật phải coi là yêu cầu **bắt buộc từ đầu**, không phải làm thêm sau.

---

## 1. Xác thực & quản lý tài khoản

### 1.1. Không lưu mật khẩu dạng plain text (nếu có dùng mật khẩu)
- Nếu thêm phương thức đăng nhập bằng mật khẩu: dùng **bcrypt** (cost factor ≥ 12) hoặc **argon2id** — không dùng MD5/SHA1/SHA256 trần.
- Hiện tại thiết kế dùng OTP qua SĐT là chính — không cần mật khẩu, nhưng nếu sau này thêm cho cán bộ (web portal), bắt buộc áp dụng quy tắc trên.

### 1.2. OTP an toàn
- OTP 6 số, hết hạn sau **5 phút**.
- Giới hạn số lần nhập sai: khóa sau 5 lần thử trong 15 phút (lockout tạm thời theo `phone_number` + IP).
- Giới hạn số lần gửi OTP: tối đa 3 lần/10 phút/số điện thoại — chống spam SMS và brute-force.
- OTP lưu dạng **hash** (không lưu plain text) trong bảng tạm, tự xóa sau khi hết hạn hoặc dùng xong.

### 1.3. Token phiên đăng nhập (session/JWT)
- Dùng **JWT với thời gian sống ngắn** (access token 15-30 phút) + **refresh token** riêng (lưu hash trong DB, thu hồi được).
- Refresh token phải **rotate** mỗi lần dùng (refresh token cũ bị vô hiệu ngay khi cấp cái mới) — chống replay attack nếu token bị đánh cắp.
- Access token ký bằng **RS256** (khóa bất đối xứng) thay vì HS256 nếu có nhiều service verify token — tránh lộ secret key dùng chung.
- Cho phép người dùng/cán bộ **thu hồi phiên đăng nhập từ xa** (đăng xuất tất cả thiết bị) khi nghi ngờ mất tài khoản.

### 1.4. Phân quyền (RBAC)
- 3 role tối thiểu: `citizen`, `officer`, `admin`.
- Officer chỉ truy vấn được tin thuộc `district_id` được phân công — kiểm tra ở **tầng backend**, không chỉ ẩn ở UI.
- Admin có audit log riêng cho mọi thao tác nhạy cảm (xem dữ liệu định danh, export dữ liệu...).

---

## 2. Mã hóa dữ liệu

### 2.1. Mã hóa khi truyền (in-transit)
- Bắt buộc **HTTPS/TLS 1.2+** cho toàn bộ API, không có endpoint HTTP thuần.
- Certificate pinning trên app di động (chống man-in-the-middle qua proxy giả mạo).

### 2.2. Mã hóa khi lưu trữ (at-rest)
- **Số điện thoại, tên thật:** mã hóa ở tầng application bằng AES-256-GCM trước khi lưu DB (không chỉ dựa vào mã hóa ổ đĩa của hệ điều hành/cloud).
- **Vị trí GPS của tin nhạy cảm:** cân nhắc mã hóa cột `location` nếu quy định địa phương yêu cầu, hoặc ít nhất giới hạn quyền truy vấn trực tiếp.
- Khóa mã hóa (encryption key) quản lý qua **key management service** riêng (Vault, AWS KMS, hoặc tự dựng nếu on-premise) — **không hardcode key trong code hoặc file .env commit lên git**.
- Ảnh/file trên MinIO: bật server-side encryption nếu MinIO hỗ trợ, giới hạn presigned URL có thời hạn ngắn (ví dụ 15 phút) thay vì để public vĩnh viễn.

### 2.3. Ẩn danh hóa khi cần
- Với tin dân báo chọn "ẩn danh với đối tượng vi phạm": tách bảng — thông tin định danh (`user_id`, SĐT thật) chỉ officer cấp cao mới truy vấn được, officer địa bàn thường chỉ thấy tin không kèm danh tính người báo.

---

## 3. Chống tấn công chiếm quyền tài khoản (Account Takeover)

- **Rate limiting theo IP + theo tài khoản** cho mọi endpoint auth (không chỉ OTP) — dùng thư viện như `express-rate-limit` hoặc tầng API Gateway/WAF.
- **Phát hiện đăng nhập bất thường:** cảnh báo nếu tài khoản đăng nhập từ vị trí/thiết bị lạ đột ngột (đặc biệt với tài khoản officer — quyền truy cập dữ liệu nhạy cảm).
- **Khóa tài khoản tạm thời** sau nhiều lần thất bại liên tiếp, kèm cơ chế mở khóa qua xác thực lại OTP.
- Với tài khoản officer: cân nhắc bắt buộc **2FA** (OTP + mật khẩu, hoặc app authenticator) vì quyền truy cập dữ liệu nhạy cảm hơn tài khoản dân thường.
- Log toàn bộ lần đăng nhập thành công/thất bại kèm IP, device fingerprint, thời gian — phục vụ điều tra khi có sự cố.

---

## 4. Chống tấn công vào Database

- **Không cho phép truy cập DB trực tiếp từ internet** — DB chỉ nghe trong private network/VPC, backend là tầng duy nhất kết nối được.
- **Prepared statements/ORM parameterized query bắt buộc** — tuyệt đối không nối chuỗi SQL thủ công (chống SQL Injection).
- **Least privilege cho DB user:** tài khoản DB dùng cho ứng dụng chỉ có quyền cần thiết (SELECT/INSERT/UPDATE trên bảng cụ thể), không dùng superuser/owner cho kết nối ứng dụng hàng ngày.
- **Backup mã hóa + kiểm tra khôi phục định kỳ** (không chỉ backup mà không test restore).
- **Audit log ở tầng DB** (pgAudit hoặc tương đương) cho các bảng nhạy cảm (`users`, `reports`, `social_media_signals`) — ghi lại ai truy vấn gì, khi nào.
- Tách **network segment riêng** cho DB, object storage, và backend — không để chung 1 subnet công khai.

---

## 5. Bảo vệ tầng ứng dụng & hạ tầng

- **Input validation nghiêm ngặt** mọi endpoint (đặc biệt file upload: giới hạn định dạng ảnh, kích thước, quét virus nếu có điều kiện, không tin metadata client gửi lên mà không kiểm tra lại).
- **Chống DDoS/spam ở tầng gateway** (Cloudflare, hoặc WAF nội bộ nếu on-premise) — đặc biệt quan trọng vì nút Cấp cứu phải luôn hoạt động được, không được để bị nghẽn do tấn công.
- **Secrets management:** toàn bộ API key, DB password, JWT secret nằm trong biến môi trường/secret manager, không commit vào git. Thêm `.env` vào `.gitignore` ngay từ đầu.
- **Dependency scanning định kỳ** (npm audit / pip-audit / Snyk) — vì hệ thống liên quan an ninh, lỗ hổng từ thư viện bên thứ ba là rủi ro thực tế hay bị bỏ qua.
- **Penetration test** trước khi đưa vào vận hành thật (không bắt buộc cho bản thi, nhưng nên ghi vào roadmap để thể hiện tư duy nghiêm túc).

---

## 6. Kế hoạch ứng phó sự cố (Incident Response) — nên có tối thiểu

- Quy trình khi phát hiện rò rỉ dữ liệu: khóa token liên quan → thông báo người dùng bị ảnh hưởng → rà log xác định phạm vi → vá lỗ hổng → báo cáo cơ quan chủ quản theo quy định.
- Có kênh log tập trung (ví dụ ELK stack hoặc đơn giản hơn là ghi log có cấu trúc + giám sát cảnh báo) để phát hiện sớm hành vi bất thường, không chỉ chờ báo cáo từ người dùng.

---

## 7. Checklist tối thiểu cho bản demo/thi (nếu không đủ thời gian làm hết mục trên)

- [ ] HTTPS bắt buộc, không có endpoint HTTP
- [ ] OTP hash, rate-limit gửi/thử OTP
- [ ] JWT access token ngắn hạn + refresh token rotate
- [ ] Mã hóa SĐT/tên thật ở tầng application (AES-256)
- [ ] Prepared statement/ORM, không raw SQL nối chuỗi
- [ ] DB user quyền giới hạn, không expose DB ra internet
- [ ] `.env`/secrets không commit git
- [ ] Rate limiting cơ bản trên toàn bộ endpoint auth
- [ ] CORS giới hạn theo allow-list (`CORS_ALLOWED_ORIGINS`), không dùng wildcard `*` ở production

Đây là phần **nên trình bày riêng 1 slide khi thi** — ban giám khảo với đề bài liên quan an ninh trật tự thường đánh giá cao việc đội thi chủ động nói về bảo mật, không cần được hỏi mới nhắc tới.
