import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAreaAlertsService } from "./areaAlerts.service.js";
import type { GeoMatchService } from "../geo/geoMatch.service.js";

interface FakeReport {
  districtId: string | null;
  source: string;
  createdAt: Date;
}

interface FakeDistrictRow {
  id: string;
  tenXa: string;
  lat: number;
  lng: number;
}

function createFakePrisma(reports: FakeReport[], districtRows: FakeDistrictRow[]) {
  return {
    report: {
      async groupBy({ where }: any) {
        const filtered = reports.filter(
          (r) => r.source === where.source && r.createdAt >= where.createdAt.gte && r.districtId !== null,
        );
        const counts = new Map<string, number>();
        for (const r of filtered) {
          counts.set(r.districtId as string, (counts.get(r.districtId as string) ?? 0) + 1);
        }
        return [...counts.entries()].map(([districtId, count]) => ({ districtId, _count: count }));
      },
    },
    async $queryRaw() {
      return districtRows.map((d) => ({ id: d.id, tenXa: d.tenXa, lat: d.lat, lng: d.lng }));
    },
  };
}

function fakeGeoMatch(districtId: string | null): GeoMatchService {
  return { matchDistrict: async () => districtId, matchNearestDistrict: async () => districtId };
}

describe("areaAlerts.service — getAreaAlerts", () => {
  it("returns every district with a zero count when nothing was reported", async () => {
    const d1 = randomUUID();
    const prisma = createFakePrisma([], [{ id: d1, tenXa: "Buôn Ma Thuột", lat: 12.68, lng: 108.05 }]);
    const service = createAreaAlertsService({ prisma: prisma as any, geoMatch: fakeGeoMatch(d1) });

    const result = await service.getAreaAlerts({ lat: 12.68, lng: 108.05 });

    expect(result.myDistrictId).toBe(d1);
    expect(result.districts).toEqual([
      { districtId: d1, tenXa: "Buôn Ma Thuột", centroidLat: 12.68, centroidLng: 108.05, reportCount: 0, alertLevel: "low" },
    ]);
  });

  it("buckets alert level by report count thresholds", async () => {
    const low = randomUUID();
    const medium = randomUUID();
    const high = randomUUID();
    const now = new Date();
    const reports: FakeReport[] = [
      { districtId: low, source: "citizen", createdAt: now },
      ...Array.from({ length: 5 }, () => ({ districtId: medium, source: "citizen", createdAt: now })),
      ...Array.from({ length: 9 }, () => ({ districtId: high, source: "citizen", createdAt: now })),
    ];
    const districtRows = [
      { id: low, tenXa: "Low", lat: 1, lng: 1 },
      { id: medium, tenXa: "Medium", lat: 2, lng: 2 },
      { id: high, tenXa: "High", lat: 3, lng: 3 },
    ];
    const prisma = createFakePrisma(reports, districtRows);
    const service = createAreaAlertsService({ prisma: prisma as any, geoMatch: fakeGeoMatch(null) });

    const result = await service.getAreaAlerts({ lat: 0, lng: 0 });
    const byName = new Map(result.districts.map((d) => [d.tenXa, d]));

    expect(byName.get("Low")?.alertLevel).toBe("low");
    expect(byName.get("Medium")?.alertLevel).toBe("medium");
    expect(byName.get("High")?.alertLevel).toBe("high");
  });

  it("excludes reports older than the 30-day lookback window", async () => {
    const d1 = randomUUID();
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const reports: FakeReport[] = [{ districtId: d1, source: "citizen", createdAt: old }];
    const prisma = createFakePrisma(reports, [{ id: d1, tenXa: "D1", lat: 1, lng: 1 }]);
    const service = createAreaAlertsService({ prisma: prisma as any, geoMatch: fakeGeoMatch(d1) });

    const result = await service.getAreaAlerts({ lat: 1, lng: 1 });
    expect(result.districts[0]?.reportCount).toBe(0);
  });

  it("returns myDistrictId null when the point matches no district", async () => {
    const prisma = createFakePrisma([], []);
    const service = createAreaAlertsService({ prisma: prisma as any, geoMatch: fakeGeoMatch(null) });

    const result = await service.getAreaAlerts({ lat: 0, lng: 0 });
    expect(result.myDistrictId).toBeNull();
  });
});
