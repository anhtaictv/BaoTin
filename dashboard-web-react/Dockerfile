# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Vite inlines VITE_-prefixed env vars into the bundle at build time, not read at container
# start. Defaults to a same-origin relative path — correct for infra/Caddyfile's single-domain
# setup (dashboard at "/", API at "/api/*" on that same domain), and means this image doesn't
# need to know the real domain at build time at all. Override only if the API is ever hosted
# on a different origin than the dashboard.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

EXPOSE 80
