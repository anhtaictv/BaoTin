# syntax=docker/dockerfile:1

# --- builder: full deps (incl. devDependencies) so tsc/prisma generate can run ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Drop devDependencies but keep the generated Prisma client + the `prisma` CLI (moved to
# "dependencies" in package.json specifically so `prisma migrate deploy` works at runtime —
# see infra/docker-compose.prod.yml's migrate step).
RUN npm prune --omit=dev

# --- runtime: slim image, no build toolchain, non-root ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S baotin && adduser -S baotin -G baotin

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# JWT keys live outside the image (bind/volume mounted at deploy time — see
# infra/docker-compose.prod.yml) so redeploys never rotate keys and invalidate live sessions.
RUN mkdir -p /app/keys && chown -R baotin:baotin /app

USER baotin
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/server.js"]
