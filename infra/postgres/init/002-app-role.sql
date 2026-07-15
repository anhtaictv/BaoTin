-- Least-privilege role for the running Express app (SECURITY.md §4: "DB user quyền giới hạn").
-- Migrations (prisma migrate dev/deploy) run as the POSTGRES_USER owner role "baotin_migrator"
-- (see infra/.env.example DATABASE_URL). The app itself connects at runtime via APP_DATABASE_URL,
-- i.e. this role — no DDL, no superuser, no ability to drop/alter tables.
--
-- Dev-only placeholder password below MUST match APP_DB_PASSWORD in your .env — change both
-- together, and never reuse this literal password outside local development.
--
-- ALTER DEFAULT PRIVILEGES is required (not a plain GRANT) because this script runs before any
-- Prisma migration has created a single table — a plain GRANT ON ALL TABLES would grant on zero
-- tables at this point. Default privileges apply automatically to tables baotin_migrator creates
-- in later migrations, so no manual re-grant is needed after each `prisma migrate deploy`.

CREATE ROLE baotin_app LOGIN PASSWORD 'changeme_app_pw';

GRANT CONNECT ON DATABASE baotin TO baotin_app;
GRANT USAGE ON SCHEMA public TO baotin_app;

ALTER DEFAULT PRIVILEGES FOR ROLE baotin_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO baotin_app;

ALTER DEFAULT PRIVILEGES FOR ROLE baotin_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO baotin_app;
