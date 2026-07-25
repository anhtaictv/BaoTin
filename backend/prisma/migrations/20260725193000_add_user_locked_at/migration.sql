-- Auto-lock on repeated false reports: null = never locked, set once a citizen's 4th
-- confirmed_false report is recorded (reportLifecycle.service.ts's checkAndLockAbusiveUser).
ALTER TABLE "users" ADD COLUMN "locked_at" TIMESTAMP(3);
