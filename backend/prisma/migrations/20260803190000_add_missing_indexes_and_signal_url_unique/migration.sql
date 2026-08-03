-- Security/perf audit (2026-08-03): missing FK indexes on hot paths + a check-then-insert
-- dedup race in the crawler (pressCrawler.service.ts) that could double-insert the same
-- article and skew signalHeat.ts's district "hot" score.

-- H1: citizen-facing report-status polling (reportLifecycle.service.ts getReportStatus) was a
-- sequential scan without this.
CREATE INDEX "report_status_history_report_id_changed_at_idx" ON "report_status_history"("report_id", "changed_at");

-- H2: lets the crawler rely on a DB-level unique-violation catch instead of a racy
-- findFirst-then-create check (see pressCrawler.service.ts). NOTE: this will fail to apply if
-- any existing rows already share a non-null source_url — check for duplicates first
-- (`SELECT source_url, count(*) FROM social_media_signals WHERE source_url IS NOT NULL GROUP BY source_url HAVING count(*) > 1;`)
-- and de-duplicate before running this migration against a populated database.
CREATE UNIQUE INDEX "social_media_signals_source_url_key" ON "social_media_signals"("source_url");

-- M1: signals.service.ts listSignals/computeHeatForScope filter directly on these.
CREATE INDEX "social_media_signals_district_id_idx" ON "social_media_signals"("district_id");
CREATE INDEX "social_media_signals_crawled_at_idx" ON "social_media_signals"("crawled_at");

-- M2: officerReports.service.ts getReportDetail's `include: { attachments: true }` — every
-- report-detail view.
CREATE INDEX "report_attachments_report_id_idx" ON "report_attachments"("report_id");

-- M3: remaining unindexed FK columns (Postgres does not auto-index FKs, unlike MySQL).
CREATE INDEX "official_case_links_report_id_idx" ON "official_case_links"("report_id");
CREATE INDEX "cameras_district_id_idx" ON "cameras"("district_id");
CREATE INDEX "traffic_accident_alerts_camera_id_idx" ON "traffic_accident_alerts"("camera_id");
CREATE INDEX "camera_extraction_requests_camera_id_idx" ON "camera_extraction_requests"("camera_id");
