-- Idempotency key for citizen report submission retries (offline queue / flaky network) —
-- see reportLifecycle.service.ts createCitizenReport. Nullable: only citizen-app submissions
-- send it; emergency reports and pre-existing rows have NULL, which does not collide under a
-- unique index in Postgres (multiple NULLs are allowed).
ALTER TABLE "reports" ADD COLUMN "client_request_id" TEXT;
CREATE UNIQUE INDEX "reports_client_request_id_key" ON "reports"("client_request_id");
