import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSearchAssistantService } from "./searchAssistant.service.js";
import type { QueryInterpreter, SearchInterpretation } from "./searchInterpreter.js";

interface FakeReport {
  id: string;
  source: string;
  districtId: string | null;
  category: string | null;
  description: string | null;
  createdAt: Date;
}

interface FakeSignal {
  id: string;
  districtId: string | null;
  summary: string | null;
  detectedCategory: string | null;
  publishedAt: Date | null;
}

function containsInsensitive(value: string | null, needle: string): boolean {
  return value != null && value.toLowerCase().includes(needle.toLowerCase());
}

function createFakeSearchPrisma() {
  const districts: { id: string; tenXa: string }[] = [];
  const reports: FakeReport[] = [];
  const signals: FakeSignal[] = [];

  return {
    seedDistrict(d: { id: string; tenXa: string }) {
      districts.push(d);
    },
    seedReport(r: FakeReport) {
      reports.push(r);
    },
    seedSignal(s: FakeSignal) {
      signals.push(s);
    },
    district: {
      async findMany() {
        return districts;
      },
    },
    report: {
      async findMany({ where }: any) {
        return reports.filter((r) => {
          if (where.source && r.source !== where.source) return false;
          if (where.districtId && r.districtId !== where.districtId) return false;
          if (where.createdAt?.gte && r.createdAt < where.createdAt.gte) return false;
          if (where.OR) {
            const matches = where.OR.some(
              (clause: any) =>
                (clause.description && containsInsensitive(r.description, clause.description.contains)) ||
                (clause.category && containsInsensitive(r.category, clause.category.contains)),
            );
            if (!matches) return false;
          }
          return true;
        });
      },
    },
    socialMediaSignal: {
      async findMany({ where }: any) {
        return signals.filter((s) => {
          if (where.districtId && s.districtId !== where.districtId) return false;
          if (where.publishedAt?.gte && (!s.publishedAt || s.publishedAt < where.publishedAt.gte)) return false;
          if (where.OR) {
            const matches = where.OR.some(
              (clause: any) =>
                (clause.summary && containsInsensitive(s.summary, clause.summary.contains)) ||
                (clause.detectedCategory && containsInsensitive(s.detectedCategory, clause.detectedCategory.contains)),
            );
            if (!matches) return false;
          }
          return true;
        });
      },
    },
  };
}

function buildService(
  fakePrisma: ReturnType<typeof createFakeSearchPrisma>,
  interpretation: SearchInterpretation | null,
) {
  const interpreter: QueryInterpreter = { interpret: async () => interpretation };
  return createSearchAssistantService({ prisma: fakePrisma as any, interpreter });
}

describe("searchAssistant.service — search", () => {
  it("returns available: false and no results when the interpreter can't parse the query", async () => {
    const fakePrisma = createFakeSearchPrisma();
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: null, category: "chay_no", description: "cháy nhà", createdAt: new Date(),
    });
    const service = buildService(fakePrisma, null);

    const result = await service.search("câu hỏi khó hiểu");
    expect(result).toEqual({ available: false, interpreted: null, reports: [], signals: [] });
  });

  it("filters by matched district name (case-insensitive)", async () => {
    const fakePrisma = createFakeSearchPrisma();
    const districtId = randomUUID();
    fakePrisma.seedDistrict({ id: districtId, tenXa: "Buôn Ma Thuột" });
    fakePrisma.seedReport({
      id: "mine", source: "citizen", districtId, category: "chay_no", description: "cháy nhà kho", createdAt: new Date(),
    });
    fakePrisma.seedReport({
      id: "elsewhere", source: "citizen", districtId: randomUUID(), category: "chay_no", description: "cháy nhà", createdAt: new Date(),
    });
    const service = buildService(fakePrisma, { districtName: "buôn ma thuột", sinceDays: null, keyword: null });

    const result = await service.search("tin ở Buôn Ma Thuột");
    expect(result.available).toBe(true);
    expect(result.interpreted).toEqual({ districtName: "Buôn Ma Thuột", sinceDays: null, keyword: null });
    expect(result.reports.map((r) => r.id)).toEqual(["mine"]);
  });

  it("ignores a district name that doesn't match any known district", async () => {
    const fakePrisma = createFakeSearchPrisma();
    fakePrisma.seedDistrict({ id: randomUUID(), tenXa: "Buôn Ma Thuột" });
    fakePrisma.seedReport({
      id: "r1", source: "citizen", districtId: null, category: "chay_no", description: "cháy nhà", createdAt: new Date(),
    });
    const service = buildService(fakePrisma, { districtName: "Nơi không tồn tại", sinceDays: null, keyword: null });

    const result = await service.search("tin ở nơi không tồn tại");
    expect(result.interpreted).toEqual({ districtName: null, sinceDays: null, keyword: null });
    expect(result.reports.map((r) => r.id)).toEqual(["r1"]);
  });

  it("filters by keyword across both reports (description/category) and signals (summary/category)", async () => {
    const fakePrisma = createFakeSearchPrisma();
    fakePrisma.seedReport({
      id: "match", source: "citizen", districtId: null, category: "chay_no", description: "Cháy lớn tại chợ", createdAt: new Date(),
    });
    fakePrisma.seedReport({
      id: "no-match", source: "citizen", districtId: null, category: "trom_cap", description: "Mất xe máy", createdAt: new Date(),
    });
    fakePrisma.seedSignal({ id: "s-match", districtId: null, summary: "Có cháy gần chợ", detectedCategory: null, publishedAt: new Date() });
    fakePrisma.seedSignal({ id: "s-no-match", districtId: null, summary: "Trộm xe máy", detectedCategory: null, publishedAt: new Date() });

    const service = buildService(fakePrisma, { districtName: null, sinceDays: null, keyword: "cháy" });
    const result = await service.search("tin cháy nổ");

    expect(result.reports.map((r) => r.id)).toEqual(["match"]);
    expect(result.signals.map((s) => s.id)).toEqual(["s-match"]);
  });

  it("filters by sinceDays", async () => {
    const fakePrisma = createFakeSearchPrisma();
    fakePrisma.seedReport({
      id: "recent", source: "citizen", districtId: null, category: null, description: null,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    fakePrisma.seedReport({
      id: "old", source: "citizen", districtId: null, category: null, description: null,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });
    const service = buildService(fakePrisma, { districtName: null, sinceDays: 7, keyword: null });

    const result = await service.search("tin tuần qua");
    expect(result.reports.map((r) => r.id)).toEqual(["recent"]);
  });

  it("only queries reports with source: citizen — never surfaces internal-only rows some other way", async () => {
    const fakePrisma = createFakeSearchPrisma();
    fakePrisma.seedReport({
      id: "citizen-report", source: "citizen", districtId: null, category: null, description: null, createdAt: new Date(),
    });
    const service = buildService(fakePrisma, { districtName: null, sinceDays: null, keyword: null });

    const result = await service.search("tất cả tin");
    expect(result.reports.map((r) => r.id)).toEqual(["citizen-report"]);
  });
});
