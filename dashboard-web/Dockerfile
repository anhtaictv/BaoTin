# syntax=docker/dockerfile:1

# Pinned as close as possible to the Flutter version this app is verified against (README.md
# "Trạng thái" — `flutter analyze`/`flutter test` run on 3.44.6 via subosito/flutter-action in
# ci.yml's dashboard-web job). cirruslabs' ghcr.io image only publishes some patch releases —
# 3.44.6 was never tagged there (confirmed against the registry's tag list), so this pins to
# the newest 3.44.x tag that actually exists. This Docker path is a dormant backup build only
# (docs/DEPLOY_DOCKER_LINUX.md) — the real deploy (deploy-windows.yml) installs Flutter
# directly via subosito/flutter-action at the exact 3.44.6 version, unaffected by this.
FROM ghcr.io/cirruslabs/flutter:3.44.0 AS builder
WORKDIR /app

COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get

COPY . .

# API_BASE_URL is compiled into the JS bundle via --dart-define (String.fromEnvironment in
# lib/core/api_client.dart) — there is no runtime env var to change after this build. Defaults
# to a same-origin relative path (see dashboard-web-react/Dockerfile's identical rationale) so
# this image doesn't need to know the real domain at build time either.
# --base-href /legacy/ matches infra/Caddyfile's `handle_path /legacy/*` — this app is served
# under that subpath on the single shared domain, not at root.
ARG API_BASE_URL=/api
RUN flutter build web --release --base-href /legacy/ --dart-define=API_BASE_URL=${API_BASE_URL}

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

EXPOSE 80
