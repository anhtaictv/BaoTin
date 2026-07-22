import type { PrismaClient } from "@prisma/client";
import { decryptField } from "../crypto/aesGcm.js";

export interface DashboardStatsDeps {
  prisma: PrismaClient;
  piiEncryptionKey: string;
}

export interface OverviewFilters {
  districtId?: string;
  days?: number;
}

const DEFAULT_DAYS = 30;

function sinceDate(days: number = DEFAULT_DAYS): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * v1.2 — read-only aggregation over existing data (no new tables). Mounted behind
 * requireAuth(["admin","senior_officer"]) only (see cameras/officerReports for the same
 * role-gated pattern) — these two roles already bypass district scoping in districtScope.ts,
 * so this service intentionally does not call it.
 */
export function createDashboardStatsService(deps: DashboardStatsDeps) {
  async function getOverview(filters: OverviewFilters) {
    const where = {
      source: "citizen" as const,
      createdAt: { gte: sinceDate(filters.days) },
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
    };

    const [totalReports, byStatusRaw, byUrgencyRaw, avgResponseTime] = await Promise.all([
      deps.prisma.report.count({ where }),
      deps.prisma.report.groupBy({ by: ["status"], where, _count: true }),
      deps.prisma.report.groupBy({ by: ["urgency"], where, _count: true }),
      deps.prisma.report.aggregate({
        where: { ...where, responseTimeSeconds: { not: null } },
        _avg: { responseTimeSeconds: true },
      }),
    ]);

    return {
      totalReports,
      byStatus: Object.fromEntries(byStatusRaw.map((r) => [r.status, r._count])),
      byUrgency: Object.fromEntries(byUrgencyRaw.map((r) => [r.urgency, r._count])),
      avgResponseTimeSeconds: avgResponseTime._avg.responseTimeSeconds ?? null,
    };
  }

  async function getResponseTimeByDistrict(filters: { days?: number }) {
    const where = {
      source: "citizen" as const,
      createdAt: { gte: sinceDate(filters.days) },
      districtId: { not: null },
    };
    const grouped = await deps.prisma.report.groupBy({
      by: ["districtId"],
      where,
      _avg: { responseTimeSeconds: true },
      _count: true,
    });

    const districtIds = grouped.map((g) => g.districtId).filter((id): id is string => id !== null);
    const districts = await deps.prisma.district.findMany({
      where: { id: { in: districtIds } },
      select: { id: true, tenXa: true },
    });
    const nameById = new Map(districts.map((d) => [d.id, d.tenXa]));

    return grouped
      .filter((g): g is typeof g & { districtId: string } => g.districtId !== null)
      .map((g) => ({
        districtId: g.districtId,
        districtName: nameById.get(g.districtId) ?? "Không rõ",
        avgResponseTimeSeconds: g._avg.responseTimeSeconds,
        reportCount: g._count,
      }))
      .sort((a, b) => (b.avgResponseTimeSeconds ?? 0) - (a.avgResponseTimeSeconds ?? 0));
  }

  async function getResponseTimeByOfficer(filters: { days?: number; districtId?: string }) {
    const where = {
      source: "citizen" as const,
      createdAt: { gte: sinceDate(filters.days) },
      assignedOfficerId: { not: null },
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
    };
    const grouped = await deps.prisma.report.groupBy({
      by: ["assignedOfficerId"],
      where,
      _avg: { responseTimeSeconds: true },
      _count: true,
    });

    const officerIds = grouped.map((g) => g.assignedOfficerId).filter((id): id is string => id !== null);
    const officers = await deps.prisma.officer.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, fullNameEnc: true, unitName: true },
    });
    const officerById = new Map(officers.map((o) => [o.id, o]));

    return grouped
      .filter((g): g is typeof g & { assignedOfficerId: string } => g.assignedOfficerId !== null)
      .map((g) => {
        const officer = officerById.get(g.assignedOfficerId);
        return {
          officerId: g.assignedOfficerId,
          // Decrypted here — never expose fullNameEnc/phoneNumberEnc ciphertext to the client.
          officerName: officer ? decryptField(officer.fullNameEnc, deps.piiEncryptionKey) : "Không rõ",
          unitName: officer?.unitName ?? null,
          avgResponseTimeSeconds: g._avg.responseTimeSeconds,
          reportCount: g._count,
        };
      })
      .sort((a, b) => (b.avgResponseTimeSeconds ?? 0) - (a.avgResponseTimeSeconds ?? 0));
  }

  async function getVolumeTrend(options: {
    days?: number;
    districtId?: string;
    /** Bucket width — 'day' (default, unchanged from before), 'week', or 'month'. Validated
     * against this exact union upstream (dashboard.schema.ts) before it ever reaches SQL —
     * date_trunc's unit argument is parameterized like any other bind value here (safe from
     * injection either way), the allow-list is just to reject nonsense values early. */
    period?: "day" | "week" | "month";
  }) {
    const days = options.days ?? DEFAULT_DAYS;
    const period = options.period ?? "day";
    // Two separate tagged-template queries (rather than a null-coalescing SQL condition) so
    // every parameter's type is unambiguous to Postgres — see ADR 0001, parameterized only.
    const rows = options.districtId
      ? await deps.prisma.$queryRaw<{ date: unknown; count: bigint }[]>`
          SELECT date_trunc(${period}, created_at) AS date, COUNT(*) AS count
          FROM reports
          WHERE source = 'citizen' AND created_at >= now() - make_interval(days => ${days}::int)
            AND district_id = ${options.districtId}
          GROUP BY date_trunc(${period}, created_at)
          ORDER BY date ASC
        `
      : await deps.prisma.$queryRaw<{ date: unknown; count: bigint }[]>`
          SELECT date_trunc(${period}, created_at) AS date, COUNT(*) AS count
          FROM reports
          WHERE source = 'citizen' AND created_at >= now() - make_interval(days => ${days}::int)
          GROUP BY date_trunc(${period}, created_at)
          ORDER BY date ASC
        `;
    return rows.map((r) => ({
      date: new Date(r.date as string | Date).toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  /** Report count per district, busiest first — the "so sánh giữa các xã/phường" ranking
   * (distinct from getResponseTimeByDistrict, which sorts by response time instead). */
  async function getReportCountByDistrict(filters: { days?: number }) {
    const where = {
      source: "citizen" as const,
      createdAt: { gte: sinceDate(filters.days) },
      districtId: { not: null },
    };
    const grouped = await deps.prisma.report.groupBy({ by: ["districtId"], where, _count: true });

    const districtIds = grouped.map((g) => g.districtId).filter((id): id is string => id !== null);
    const districts = await deps.prisma.district.findMany({
      where: { id: { in: districtIds } },
      select: { id: true, tenXa: true },
    });
    const nameById = new Map(districts.map((d) => [d.id, d.tenXa]));

    return grouped
      .filter((g): g is typeof g & { districtId: string } => g.districtId !== null)
      .map((g) => ({
        districtId: g.districtId,
        districtName: nameById.get(g.districtId) ?? "Không rõ",
        reportCount: g._count,
      }))
      .sort((a, b) => b.reportCount - a.reportCount);
  }

  /** Report count per category ("Trộm cắp", "Tai nạn", ...) — category is free-text
   * (Report.category is String?, not an enum), null coalesced to "khac" matching the app's
   * existing fallback-category convention (core/theme.dart categoryLabel on both apps). */
  async function getByCategory(filters: { days?: number; districtId?: string }) {
    const where = {
      source: "citizen" as const,
      createdAt: { gte: sinceDate(filters.days) },
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
    };
    const grouped = await deps.prisma.report.groupBy({ by: ["category"], where, _count: true });
    return grouped
      .map((g) => ({ category: (g.category as string | null) ?? "khac", count: g._count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Report locations for the admin-wide map — reuses the same ST_X/ST_Y-over-Unsupported(...)
   * trick officerReports.service.ts already uses (Prisma silently omits PostGIS geometry
   * columns from normal queries), just without officerReports' per-district scoping since this
   * is explicitly the whole-province view. */
  async function getReportLocations(filters: { days?: number; districtId?: string }) {
    const days = filters.days ?? DEFAULT_DAYS;
    type Row = {
      id: string;
      lat: number;
      lng: number;
      status: string;
      category: string | null;
      urgency: string;
      createdAt: Date;
    };
    const rows = filters.districtId
      ? await deps.prisma.$queryRaw<Row[]>`
          SELECT id, ST_Y(location) AS lat, ST_X(location) AS lng, status, category, urgency, created_at AS "createdAt"
          FROM reports
          WHERE source = 'citizen' AND created_at >= now() - make_interval(days => ${days}::int)
            AND district_id = ${filters.districtId}
        `
      : await deps.prisma.$queryRaw<Row[]>`
          SELECT id, ST_Y(location) AS lat, ST_X(location) AS lng, status, category, urgency, created_at AS "createdAt"
          FROM reports
          WHERE source = 'citizen' AND created_at >= now() - make_interval(days => ${days}::int)
        `;
    return rows.map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      status: r.status,
      category: r.category ?? "khac",
      urgency: r.urgency,
      createdAt: r.createdAt,
    }));
  }

  async function getCameraQueueStats() {
    const grouped = await deps.prisma.cameraExtractionRequest.groupBy({
      by: ["status"],
      _count: true,
    });
    return Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  }

  /** Backs the district filter dropdown in dashboard-web — full list, not report-filtered. */
  async function getDistrictOptions() {
    return deps.prisma.district.findMany({
      select: { id: true, tenXa: true },
      orderBy: { tenXa: "asc" },
    });
  }

  return {
    getOverview,
    getResponseTimeByDistrict,
    getResponseTimeByOfficer,
    getVolumeTrend,
    getReportCountByDistrict,
    getByCategory,
    getReportLocations,
    getCameraQueueStats,
    getDistrictOptions,
  };
}

export type DashboardStatsService = ReturnType<typeof createDashboardStatsService>;
