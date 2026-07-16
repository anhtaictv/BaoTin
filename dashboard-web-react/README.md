# dashboard-web-react

Phiên bản React của web quản lý Báo Tin — dùng chung backend/database với `dashboard-web`
(Flutter Web) và các app Flutter khác trong repo. Đăng nhập bằng tài khoản username/password
riêng (bảng `web_accounts`, khác luồng OTP của app cán bộ Flutter) — xem `backend/prisma/seed/seed-web-accounts.ts`
để cấp tài khoản ban đầu cho 102 xã/phường.

## Stack

Vite + React + TypeScript · `react-router-dom` · `@tanstack/react-query` · `axios` · `recharts` ·
Vitest + `@testing-library/react`.

## Setup

```bash
npm install
cp .env.example .env   # chỉnh VITE_API_BASE_URL nếu backend không chạy ở localhost:3000
npm run dev
```

```bash
npm run typecheck   # tsc -b
npm run test        # vitest run
```

Cần backend đang chạy (`cd ../backend && npm run dev`, kèm Postgres/MinIO qua
`../infra/docker-compose.yml`) và origin dev của Vite (mặc định `http://localhost:5173`) có
trong `CORS_ALLOWED_ORIGINS` của `backend/.env`.
