import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSignalsService } from "./signals.service.js";
import { createDistrictScopeService } from "../middleware/districtScope.js";
import { createFakeSignalsPrisma, type FakeSignalsPrisma } from "../test-utils/fakeSignalsPrisma.js";
import type { HeatNarrator } from "./heatNarrative.js";

function buildService(fakePrisma: FakeSignalsPrisma, heatNarrator?: HeatNarrator) {
  const districtScope = createDistrictScopeService(fakePrisma as any);
  return createSignalsService({ prisma: fakePrisma as any, districtScope, heatNarrator });
}

describe("signals.service — listSignals", () => {
  it("a regular officer only sees signals in their assigned district", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const officerId = randomUUID();
    const myDistrict = randomUUID();
    const otherDistrict = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: myDistrict, isActive: true });
    fakePrisma.seedSignal({
      id: "mine", sourceName: "Báo A", sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId: myDistrict, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    fakePrisma.seedSignal({
      id: "not-mine", sourceName: "Báo B", sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId: otherDistrict, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });

    const service = buildService(fakePrisma);
    const results = await service.listSignals({ id: officerId, role: "officer" }, {});
    expect(results.map((s) => s.id)).toEqual(["mine"]);
  });

  it("rejects an explicit district_id filter outside the officer's assignments", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const officerId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: randomUUID(), isActive: true });
    const service = buildService(fakePrisma);

    await expect(
      service.listSignals({ id: officerId, role: "officer" }, { districtId: randomUUID() }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("admin sees across districts without an assignment row", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    fakePrisma.seedSignal({
      id: "any-district", sourceName: null, sourceUrl: null, trustLevel: "unverified_social", summary: null,
      districtId: randomUUID(), detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    const service = buildService(fakePrisma);
    const results = await service.listSignals({ id: randomUUID(), role: "admin" }, {});
    expect(results).toHaveLength(1);
  });

  it("filters by trustLevel", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    fakePrisma.seedSignal({
      id: "press", sourceName: null, sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId: null, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    fakePrisma.seedSignal({
      id: "social", sourceName: null, sourceUrl: null, trustLevel: "unverified_social", summary: null,
      districtId: null, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    const service = buildService(fakePrisma);
    const results = await service.listSignals({ id: randomUUID(), role: "admin" }, { trustLevel: "verified_press" });
    expect(results.map((s) => s.id)).toEqual(["press"]);
  });

  it("attaches a heat score computed across ALL signals in the district, not just the filtered ones", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const districtId = randomUUID();
    fakePrisma.seedSignal({
      id: "press", sourceName: null, sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    // Not returned by this filtered query (trustLevel=verified_press) but should still count
    // toward the district's heat score.
    fakePrisma.seedSignal({
      id: "social", sourceName: null, sourceUrl: null, trustLevel: "unverified_social", summary: null,
      districtId, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });

    const service = buildService(fakePrisma);
    const results = await service.listSignals({ id: randomUUID(), role: "admin" }, { trustLevel: "verified_press" });

    expect(results).toHaveLength(1);
    expect(results[0]?.heat).toEqual({ score: 2, level: "medium" });
  });

  it("heat is null for a signal with no district", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    fakePrisma.seedSignal({
      id: "no-district", sourceName: null, sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId: null, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    const service = buildService(fakePrisma);
    const results = await service.listSignals({ id: randomUUID(), role: "admin" }, {});
    expect(results[0]?.heat).toBeNull();
  });
});

describe("signals.service — getSignalDetail", () => {
  it("404s for a non-existent signal", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const service = buildService(fakePrisma);
    await expect(service.getSignalDetail({ id: randomUUID(), role: "officer" }, randomUUID())).rejects.toMatchObject({
      status: 404,
    });
  });

  it("403s when the signal belongs to a district outside the officer's assignment", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const officerId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: randomUUID(), isActive: true });
    fakePrisma.seedSignal({
      id: "s1", sourceName: null, sourceUrl: null, trustLevel: "unverified_social", summary: null,
      districtId: randomUUID(), detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    const service = buildService(fakePrisma);
    await expect(service.getSignalDetail({ id: officerId, role: "officer" }, "s1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("returns the full signal for senior_officer regardless of district", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    fakePrisma.seedSignal({
      id: "s1", sourceName: "Báo C", sourceUrl: "https://example.com/a", trustLevel: "verified_press",
      summary: "Tóm tắt demo", districtId: randomUUID(), detectedCategory: "trom_cap",
      publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    const service = buildService(fakePrisma);
    const detail = await service.getSignalDetail({ id: randomUUID(), role: "senior_officer" }, "s1");
    expect(detail.sourceName).toBe("Báo C");
    expect(detail.summary).toBe("Tóm tắt demo");
  });

  it("returns null heat and no related reports when the signal has no district", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    fakePrisma.seedSignal({
      id: "s1", sourceName: null, sourceUrl: null, trustLevel: "unverified_social", summary: null,
      districtId: null, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    const service = buildService(fakePrisma);
    const detail = await service.getSignalDetail({ id: randomUUID(), role: "admin" }, "s1");
    expect(detail.heat).toBeNull();
    expect(detail.relatedReports).toEqual([]);
  });

  it("finds citizen reports in the same district within the ±3-day window, but not outside it", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const districtId = randomUUID();
    const publishedAt = new Date("2026-01-10T00:00:00Z");
    fakePrisma.seedSignal({
      id: "s1", sourceName: null, sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId, detectedCategory: "trom_cap", publishedAt, crawledAt: publishedAt, duplicateOfId: null,
    });
    fakePrisma.seedReport({
      id: "nearby", source: "citizen", districtId, category: "Trộm cắp", status: "pending", urgency: "normal",
      createdAt: new Date("2026-01-11T00:00:00Z"), // +1 day, within window
    });
    fakePrisma.seedReport({
      id: "too-far", source: "citizen", districtId, category: "Trộm cắp", status: "pending", urgency: "normal",
      createdAt: new Date("2026-01-20T00:00:00Z"), // +10 days, outside window
    });
    fakePrisma.seedReport({
      id: "other-district", source: "citizen", districtId: randomUUID(), category: "Trộm cắp", status: "pending", urgency: "normal",
      createdAt: new Date("2026-01-10T12:00:00Z"),
    });

    const service = buildService(fakePrisma);
    const detail = await service.getSignalDetail({ id: randomUUID(), role: "admin" }, "s1");

    expect(detail.relatedReports.map((r: any) => r.id)).toEqual(["nearby"]);
  });

  it("computes a heat narrative when heat is medium/high, passing the district's recent signals", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const districtId = randomUUID();
    fakePrisma.seedDistrict({ id: districtId, tenXa: "Buôn Ma Thuột" });
    fakePrisma.seedSignal({
      id: "s1", sourceName: null, sourceUrl: null, trustLevel: "verified_press", summary: "Cháy nhỏ gần chợ",
      districtId, detectedCategory: "chay_no", publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    fakePrisma.seedSignal({
      id: "s2", sourceName: null, sourceUrl: null, trustLevel: "unverified_social", summary: "Có khói gần chợ",
      districtId, detectedCategory: "chay_no", publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });

    const heatNarrator: HeatNarrator = {
      generate: async (input) => {
        expect(input.districtName).toBe("Buôn Ma Thuột");
        expect(input.signals).toHaveLength(2);
        return "Khu vực đang có nhiều tin về cháy nổ gần chợ trung tâm.";
      },
    };
    const service = buildService(fakePrisma, heatNarrator);
    const detail = await service.getSignalDetail({ id: randomUUID(), role: "admin" }, "s1");

    expect(detail.heat).toEqual({ score: 2, level: "medium" });
    expect(detail.heatNarrative).toBe("Khu vực đang có nhiều tin về cháy nổ gần chợ trung tâm.");
  });

  it("does not compute a heat narrative when heat is low", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const districtId = randomUUID();
    fakePrisma.seedSignal({
      id: "s1", sourceName: null, sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });

    let called = false;
    const heatNarrator: HeatNarrator = { generate: async () => { called = true; return "should not happen"; } };
    const service = buildService(fakePrisma, heatNarrator);
    const detail = await service.getSignalDetail({ id: randomUUID(), role: "admin" }, "s1");

    expect(detail.heat).toEqual({ score: 1, level: "low" });
    expect(detail.heatNarrative).toBeNull();
    expect(called).toBe(false);
  });

  it("defaults to no narrative (NoopHeatNarrator) when none is injected, even at high heat", async () => {
    const fakePrisma = createFakeSignalsPrisma();
    const districtId = randomUUID();
    for (let i = 0; i < 5; i++) {
      fakePrisma.seedSignal({
        id: `s${i}`, sourceName: null, sourceUrl: null, trustLevel: "verified_press", summary: null,
        districtId, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
      });
    }
    const service = buildService(fakePrisma);
    const detail = await service.getSignalDetail({ id: randomUUID(), role: "admin" }, "s0");

    expect(detail.heat).toEqual({ score: 5, level: "high" });
    expect(detail.heatNarrative).toBeNull();
  });
});
