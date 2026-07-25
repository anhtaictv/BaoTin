-- Perf: reports.status / assigned_officer_id are filtered directly (officerReports
-- listReports, dashboard groupBy); (source, created_at) covers the WHERE clause common to
-- every dashboardStats query (getOverview/getVolumeTrend/getReportLocations/... all filter
-- source='citizen' AND created_at >= X first, optionally + district_id which is already
-- indexed on its own).
CREATE INDEX "reports_status_idx" ON "reports"("status");
CREATE INDEX "reports_assigned_officer_id_idx" ON "reports"("assigned_officer_id");
CREATE INDEX "reports_source_created_at_idx" ON "reports"("source", "created_at");

-- PostGIS geometry columns are Unsupported(...) in schema.prisma (see docs/adr/0001) so
-- Prisma's schema DSL can't declare these — hand-written like the columns themselves.
-- None of the 3 geometry columns had a spatial index before this: geoMatch.service.ts's
-- ST_Contains(boundary, point) ran on every single report submission as a sequential scan +
-- exact polygon math over all districts, matchNearestDistrict's KNN `<->` couldn't use an
-- index scan at all, and cameraExtraction.service.ts's ST_DWithin nearby-camera lookup
-- scanned every camera row per request.
CREATE INDEX "districts_boundary_gist_idx" ON "districts" USING GIST ("boundary");
CREATE INDEX "cameras_location_gist_idx" ON "cameras" USING GIST ("location");
CREATE INDEX "reports_location_gist_idx" ON "reports" USING GIST ("location");
