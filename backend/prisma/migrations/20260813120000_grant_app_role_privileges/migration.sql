-- Re-applies infra/postgres/init/002-app-role.sql's GRANTs idempotently through Prisma's
-- tracked migration history, instead of relying only on Postgres's docker-entrypoint-initdb.d
-- / docs/DEPLOY.md Phần 1.3 manual setup — both only ever run once, against an empty volume or
-- a freshly created cluster. Any database whose Postgres data directory pre-dates that script
-- (found on local dev 2026-08-13 — see docs/NHATKY_2026-08-13.md) is left with role
-- `baotin_app` existing but with ZERO privileges on schema public, so every runtime query
-- (backend/src/db/prisma.ts connects as baotin_app via APP_DATABASE_URL) fails with
-- "permission denied for schema public". Running this as a migration guarantees it's applied
-- on every environment `prisma migrate deploy` touches (dev, prod, any future one), regardless
-- of when that environment's Postgres cluster was first created. Runs as baotin_migrator, which
-- owns the `baotin` database/schema/tables — no superuser needed.
GRANT CONNECT ON DATABASE baotin TO baotin_app;
GRANT USAGE ON SCHEMA public TO baotin_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO baotin_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO baotin_app;

ALTER DEFAULT PRIVILEGES FOR ROLE baotin_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO baotin_app;
ALTER DEFAULT PRIVILEGES FOR ROLE baotin_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO baotin_app;
