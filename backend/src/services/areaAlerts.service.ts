import type { PrismaClient } from "@prisma/client";
import type { GeoMatchService } from "../geo/geoMatch.service.js";

export interface AreaAlertsDeps {
  prisma: PrismaClient;
  geoMatch: GeoMatchService;
}

export type AlertLevel = "low" | "medium" | "high";

export interface DistrictAlert {
  districtId: string;
  tenXa: string;
  centroidLat: number;
  centroidLng: number;
  reportCount: number;
  alertLevel: AlertLevel;
}

export interface AreaAlertsResult {
  myDistrictId: string | null;
  districts: DistrictAlert[];
}

const LOOKBACK_DAYS = 30;
/** reportCount >= this -> "high"; >= ALERT_THRESHOLD_MEDIUM but below -> "medium"; else "low". */
const ALERT_THRESHOLD_HIGH = 8;
const ALERT_THRESHOLD_MEDIUM = 3;

function alertLevelFor(reportCount: number): AlertLevel {
  if (reportCount >= ALERT_THRESHOLD_HIGH) return "high";
  if (reportCount >= ALERT_THRESHOLD_MEDIUM) return "medium";
  return "low";
}

/**
 * Giai đoạn 3 "Bản đồ cảnh báo khu vực" — API_SPEC.md `GET /area-alerts`. Returns only
 * aggregated counts per xã/phường (never an individual report's location/detail — CLAUDE.md-
 * style privacy requirement carried over from Signal's trust-level segregation). Covers
 * every seeded district, not just ones near lat/lng — the whole coverage area is small
 * enough (102 wards) that filtering by radius buys nothing but complexity; lat/lng only
 * decides which district is "yours" for highlighting on the map.
 */
export function createAreaAlertsService(deps: AreaAlertsDeps) {
  async function getAreaAlerts(params: { lat: number; lng: number }): Promise<AreaAlertsResult> {
    const myDistrictId = await deps.geoMatch.matchDistrict(params);

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const grouped = await deps.prisma.report.groupBy({
      by: ["districtId"],
      where: { source: "citizen", createdAt: { gte: since }, districtId: { not: null } },
      _count: true,
    });
    const countByDistrict = new Map(grouped.map((g) => [g.districtId as string, g._count]));

    const rows = await deps.prisma.$queryRaw<{ id: string; tenXa: string; lat: number; lng: number }[]>`
      SELECT id, ten_xa AS "tenXa", ST_Y(ST_Centroid(boundary)) AS lat, ST_X(ST_Centroid(boundary)) AS lng
      FROM districts
    `;

    const districts: DistrictAlert[] = rows.map((row) => {
      const reportCount = countByDistrict.get(row.id) ?? 0;
      return {
        districtId: row.id,
        tenXa: row.tenXa,
        centroidLat: row.lat,
        centroidLng: row.lng,
        reportCount,
        alertLevel: alertLevelFor(reportCount),
      };
    });

    return { myDistrictId, districts };
  }

  return { getAreaAlerts };
}

export type AreaAlertsService = ReturnType<typeof createAreaAlertsService>;
