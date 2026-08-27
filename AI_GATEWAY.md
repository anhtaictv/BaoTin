# AI Gateway dùng chung (QuanLyTinBai / BaoTin / Soul Diary)

> File này giống hệt nhau ở gốc cả 3 repo: `D:/APP/WebApp`, `D:/APP/BaoTin`,
> `D:/APP/nhat-ky-fullstack`. Đọc file này trước khi thêm/sửa bất kỳ tính năng AI nào
> trong repo hiện tại — đừng tự gọi thẳng Ollama/Claude/OpenAI riêng lẻ.

## Có gì

Cả 3 app đều chạy trên cùng 1 VPS (`meobeo`, 160.191.46.223). AI xử lý cục bộ (Ollama)
chạy trên 1 PC cá nhân riêng ("máy A"), nối vào VPS qua Tailscale — PC này có thể tắt/
ngủ/offline bất cứ lúc nào. Để 3 app không cùng mất AI khi máy A tắt, có **1 AI Gateway**
đứng giữa, chạy ngay trên VPS này:

```
App backend (QuanLyTinBai / BaoTin / Soul Diary)
      │  http://127.0.0.1:8080/v1/...
      ▼
  AI Gateway (project: D:/APP/ai-gateway)
      ├──► Ollama trên máy A qua Tailscale   (ưu tiên)
      └──► Claude API / OpenAI API           (fallback khi máy A không tới được)
```

Gateway tự lo: thử máy A trước, fallback cloud khi cần, giới hạn số request đồng thời,
giữ khoá API — app không cần biết provider thật đứng sau là ai.

Chi tiết đầy đủ (lý do, các bước hạ tầng, Tailscale ACL...) xem
`C:\Users\Admin\Desktop\ke-hoach-ai-local-tailscale.md` và `D:/APP/ai-gateway/README.md`.

## Hợp đồng gọi (đúng chuẩn OpenAI — không phải format riêng)

- Base URL: `http://127.0.0.1:8080/v1` (gateway và app cùng chạy trên VPS này, không
  cần Tailscale ở chặng này).
- Auth: header `Authorization: Bearer <GATEWAY_API_KEY>` — xin khoá từ nơi lưu secret
  chung, KHÔNG hardcode trong code.
- `POST /v1/chat/completions` — body/response y hệt OpenAI chat completions
  (`{ messages: [{role, content}] }` → `{ choices: [{ message: { role, content } }] }`).
- `POST /v1/embeddings` — body/response y hệt OpenAI embeddings.
- `GET http://127.0.0.1:8080/health` (không cần auth) — `{ ollama: bool, fallbackProvider }`.
- Vì đúng chuẩn OpenAI, có thể dùng thẳng SDK `openai` (nếu app đã có/muốn dùng) trỏ
  `baseURL: 'http://127.0.0.1:8080/v1'`, `apiKey: <GATEWAY_API_KEY>` — không cần viết
  client riêng.

## Trạng thái hiện tại (quan trọng — đọc kỹ trước khi code)

- Gateway đã build xong, **chưa deploy lên VPS thật** (đang chờ máy A lên tailnet ổn định).
- **QuanLyTinBai đang có tích hợp Ollama TRỰC TIẾP riêng** (xây trước khi có gateway) ở
  `backend/backend/services/ollamaClient.js` + `controllers/aiController.js` +
  `controllers/ragController.js` — CHƯA migrate sang gọi qua gateway này. Đây là việc
  cần cân nhắc, không tự chuyển khi chưa được yêu cầu.
- **BaoTin và Soul Diary (nhat-ky-fullstack) chưa gọi AI Gateway ở đâu cả** — nhat-ky-
  fullstack hiện có tích hợp Gemini riêng (`@google/generative-ai`) không liên quan đến
  gateway này.
- Việc cụ thể "app này cần thêm tính năng AI gì, gọi ở đâu trong code" **chưa được
  quyết** — hỏi người dùng trước khi tự đoán và code khi thực sự bắt tay vào việc đó.
