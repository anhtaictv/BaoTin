import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDashboardStatsService } from "./dashboardStats.service.js";
import { encryptField } from "../crypto/aesGcm.js";
import { createFakeDashboardPrisma, type FakeDashboardPrisma } from "../test-utils/fakeDashboardPrisma.js";

const PII_KEY = randomBytes(32).toString("base64");

function buildService(fakePrisma: FakeDashboardPrisma) {
  return createDashboardStatsService({ prisma: fakePrisma as any, piiEncryptionKey: PII_KEY });
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe("dashboardStats.service — getOverview", () => {
  it("counts totals, by status, by urgency, and computes avg response time from verified reports only", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const districtId = randomUUID();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId, assignedOfficerId: null,
      status: "confirmed_true", urgency: "normal", responseTimeSeconds: 100, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId, assignedOfficerId: null,
      status: "pending", urgency: "emergency", responseTimeSeconds: null, createdAt: daysAgo(2),
    });
    // Outside the 30-day window — must be excluded.
    fakePrisma.seedReport({
      id: "r3", source: "citizen", districtId, assignedOfficerId: null,
      status: "confirmed_true", urgency: "normal", responseTimeSeconds: 9999, createdAt: daysAgo(60),
    });

    const service = buildService(fakePrisma);
    const overview = await service.getOverview({});

    expect(overview.totalReports).toBe(2);
    expect(overview.byStatus).toMatchObject({ confirmed_true: 1, pending: 1 });
    expect(overview.byUrgency).toMatchObject({ normal: 1, emergency: 1 });
    expect(overview.avgResponseTimeSeconds).toBe(100);
  });

  it("filters by districtId when provided", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const districtA = randomUUID();
    const districtB = randomUUID();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: districtA, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: districtB, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const overview = await service.getOverview({ districtId: districtA });
    expect(overview.totalReports).toBe(1);
  });
});

describe("dashboardStats.service — getResponseTimeByDistrict", () => {
  it("averages response time per district and joins the district name, worst first", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const fastDistrict = randomUUID();
    const slowDistrict = randomUUID();
    fakePrisma.seedDistrict({ id: fastDistrict, tenXa: "Phường Nhanh" });
    fakePrisma.seedDistrict({ id: slowDistrict, tenXa: "Phường Chậm" });
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: fastDistrict, assignedOfficerId: null,
      status: "confirmed_true", urgency: "normal", responseTimeSeconds: 60, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: slowDistrict, assignedOfficerId: null,
      status: "confirmed_true", urgency: "normal", responseTimeSeconds: 600, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const result = await service.getResponseTimeByDistrict({});

    expect(result[0]?.districtName).toBe("Phường Chậm");
    expect(result[0]?.avgResponseTimeSeconds).toBe(600);
    expect(result[1]?.districtName).toBe("Phường Nhanh");
  });
});

describe("dashboardStats.service — getResponseTimeByOfficer", () => {
  it("decrypts the officer's name — never returns ciphertext", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const officerId = randomUUID();
    fakePrisma.seedOfficer({
      id: officerId,
      fullNameEnc: encryptField("[DEMO] Nguyễn Văn A", PII_KEY),
      unitName: "Công an phường X",
    });
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: null, assignedOfficerId: officerId,
      status: "confirmed_true", urgency: "normal", responseTimeSeconds: 120, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const [result] = await service.getResponseTimeByOfficer({});

    expect(result?.officerName).toBe("[DEMO] Nguyễn Văn A");
    expect(result?.unitName).toBe("Công an phường X");
    expect(JSON.stringify(result)).not.toContain("iv");
  });

  it("filters by districtId when provided", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const officerA = randomUUID();
    const officerB = randomUUID();
    const districtA = randomUUID();
    const districtB = randomUUID();
    fakePrisma.seedOfficer({ id: officerA, fullNameEnc: encryptField("A", PII_KEY), unitName: null });
    fakePrisma.seedOfficer({ id: officerB, fullNameEnc: encryptField("B", PII_KEY), unitName: null });
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: districtA, assignedOfficerId: officerA,
      status: "confirmed_true", urgency: "normal", responseTimeSeconds: 60, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: districtB, assignedOfficerId: officerB,
      status: "confirmed_true", urgency: "normal", responseTimeSeconds: 600, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const result = await service.getResponseTimeByOfficer({ districtId: districtA });

    expect(result).toHaveLength(1);
    expect(result[0]?.officerId).toBe(officerA);
  });
});

describe("dashboardStats.service — getVolumeTrend", () => {
  it("buckets citizen reports by day within the window, ascending", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: null, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: null, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r3", source: "citizen", districtId: null, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(2),
    });

    const service = buildService(fakePrisma);
    const trend = await service.getVolumeTrend({ days: 30 });

    expect(trend).toHaveLength(2);
    expect(trend[0]!.date < trend[1]!.date).toBe(true);
    const dayWithTwo = trend.find((t) => t.count === 2);
    expect(dayWithTwo).toBeDefined();
  });

  it("filters by districtId when provided", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const districtA = randomUUID();
    const districtB = randomUUID();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: districtA, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: districtB, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const trend = await service.getVolumeTrend({ days: 30, districtId: districtA });

    expect(trend).toHaveLength(1);
    expect(trend[0]?.count).toBe(1);
  });
});

describe("dashboardStats.service — getVolumeTrend period", () => {
  it("buckets by week when period='week' — two reports 2 days apart land in the same ISO week", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: null, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(3),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: null, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const daily = await service.getVolumeTrend({ days: 30, period: "day" });
    const weekly = await service.getVolumeTrend({ days: 30, period: "week" });

    expect(daily).toHaveLength(2);
    expect(weekly.reduce((sum, w) => sum + w.count, 0)).toBe(2);
  });
});

describe("dashboardStats.service — getReportCountByDistrict", () => {
  it("counts reports per district, busiest first", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const busy = randomUUID();
    const quiet = randomUUID();
    fakePrisma.seedDistrict({ id: busy, tenXa: "Phường Đông" });
    fakePrisma.seedDistrict({ id: quiet, tenXa: "Phường Vắng" });
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: busy, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: busy, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r3", source: "citizen", districtId: quiet, assignedOfficerId: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const result = await service.getReportCountByDistrict({});

    expect(result[0]).toMatchObject({ districtName: "Phường Đông", reportCount: 2 });
    expect(result[1]).toMatchObject({ districtName: "Phường Vắng", reportCount: 1 });
  });
});

describe("dashboardStats.service — getByCategory", () => {
  it("counts reports per category, most common first, coalescing null to 'khac'", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: null, assignedOfficerId: null, category: "trom_cap",
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: null, assignedOfficerId: null, category: "trom_cap",
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });
    fakePrisma.seedReport({
      id: "r3", source: "citizen", districtId: null, assignedOfficerId: null, category: null,
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
    });

    const service = buildService(fakePrisma);
    const result = await service.getByCategory({});

    expect(result[0]).toMatchObject({ category: "trom_cap", count: 2 });
    expect(result[1]).toMatchObject({ category: "khac", count: 1 });
  });
});

describe("dashboardStats.service — getReportLocations", () => {
  it("returns lat/lng + status/category/urgency for the map, filtered by window", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: null, assignedOfficerId: null, category: "chay_no",
      status: "verifying", urgency: "emergency", responseTimeSeconds: null, createdAt: daysAgo(1),
      lat: 12.678, lng: 108.05,
    });
    // Outside the window — must be excluded.
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: null, assignedOfficerId: null, category: "khac",
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(60),
      lat: 12.9, lng: 108.2,
    });

    const service = buildService(fakePrisma);
    const result = await service.getReportLocations({ days: 30 });

    expect(result).toEqual([
      {
        id: "r1", lat: 12.678, lng: 108.05, status: "verifying", category: "chay_no",
        urgency: "emergency", createdAt: expect.any(Date),
      },
    ]);
  });

  it("filters by districtId when provided", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    const districtA = randomUUID();
    const districtB = randomUUID();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: districtA, assignedOfficerId: null, category: "khac",
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
      lat: 1, lng: 1,
    });
    fakePrisma.seedReport({
      id: "r2", source: "citizen", districtId: districtB, assignedOfficerId: null, category: "khac",
      status: "pending", urgency: "normal", responseTimeSeconds: null, createdAt: daysAgo(1),
      lat: 2, lng: 2,
    });

    const service = buildService(fakePrisma);
    const result = await service.getReportLocations({ days: 30, districtId: districtA });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("r1");
  });
});

describe("dashboardStats.service — getCameraQueueStats", () => {
  it("counts extraction requests by status", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    fakePrisma.seedExtractionRequest({ id: "e1", status: "pending" });
    fakePrisma.seedExtractionRequest({ id: "e2", status: "pending" });
    fakePrisma.seedExtractionRequest({ id: "e3", status: "fulfilled" });

    const service = buildService(fakePrisma);
    const stats = await service.getCameraQueueStats();

    expect(stats).toMatchObject({ pending: 2, fulfilled: 1 });
  });
});

describe("dashboardStats.service — getDistrictOptions", () => {
  it("lists all districts alphabetically, regardless of report activity", async () => {
    const fakePrisma = createFakeDashboardPrisma();
    fakePrisma.seedDistrict({ id: "d1", tenXa: "Phường Z" });
    fakePrisma.seedDistrict({ id: "d2", tenXa: "Phường A" });

    const service = buildService(fakePrisma);
    const options = await service.getDistrictOptions();

    expect(options.map((d) => d.tenXa)).toEqual(["Phường A", "Phường Z"]);
  });
});
