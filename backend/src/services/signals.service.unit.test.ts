import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSignalsService } from "./signals.service.js";
import { createDistrictScopeService } from "../middleware/districtScope.js";
import { createFakeSignalsPrisma, type FakeSignalsPrisma } from "../test-utils/fakeSignalsPrisma.js";

function buildService(fakePrisma: FakeSignalsPrisma) {
  const districtScope = createDistrictScopeService(fakePrisma as any);
  return createSignalsService({ prisma: fakePrisma as any, districtScope });
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
});
