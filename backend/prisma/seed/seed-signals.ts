import type { PrismaClient } from "@prisma/client";

export interface SeedSignalSpec {
  sourceName: string;
  sourceUrl?: string | null;
  trustLevel: "verified_press" | "unverified_social";
  summary: string;
  rawSnippet: string;
  /** Must match a districts.ten_xa value seeded from data/raw/Daklak.geojson, or null if the crawler couldn't geo-match. */
  wardTenXa: string | null;
  detectedCategory: string;
  publishedAt: Date;
  /** Index into this same array — marks this entry as a near-duplicate of an earlier one, to
   * demo dedup grouping in the UI. Never decided by an AI/crawler "truth" judgment — just a
   * same-story flag (CLAUDE.md #3: no automatic true/false conclusion, that stays human-only
   * and only ever applies to Reports, never Signals in the first place). */
  duplicateOfIndex?: number;
}

/**
 * Giai đoạn 2 "kênh tình báo mở" — obviously-fake demo signals ([DEMO] prefix in sourceName),
 * standing in for what an RSS/MXH crawler would produce. CLAUDE.md non-negotiable #4: no live
 * crawling during demo/thi, seed data only.
 */
export const SEED_SIGNALS: SeedSignalSpec[] = [
  {
    sourceName: "[DEMO] Báo Đắk Lắk Online",
    sourceUrl: "https://example.com/bao-dak-lak/tin-1",
    trustLevel: "verified_press",
    summary: "Công an phường Buôn Ma Thuột đang xác minh vụ trộm xe máy trên đường Lê Duẩn.",
    rawSnippet: "Theo nguồn tin từ công an địa phương, khoảng 22h ngày hôm qua...",
    wardTenXa: "Buôn Ma Thuột",
    detectedCategory: "trom_cap",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    sourceName: "[DEMO] Facebook — Hội cư dân Buôn Ma Thuột",
    sourceUrl: "https://example.com/social/post-1",
    trustLevel: "unverified_social",
    summary: "Người dân phản ánh nghi có cháy nhỏ gần chợ trung tâm, chưa rõ nguyên nhân.",
    rawSnippet: "mọi người ơi gần chợ có khói nghi cháy, ai biết gì không...",
    wardTenXa: "Buôn Ma Thuột",
    detectedCategory: "chay_no",
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    sourceName: "[DEMO] Facebook — Hội cư dân Buôn Ma Thuột",
    sourceUrl: "https://example.com/social/post-2",
    trustLevel: "unverified_social",
    summary: "Người dân phản ánh nghi có cháy nhỏ gần chợ trung tâm, chưa rõ nguyên nhân.",
    rawSnippet: "xác nhận có khói ở gần chợ trung tâm, mọi người cẩn thận...",
    wardTenXa: "Buôn Ma Thuột",
    detectedCategory: "chay_no",
    publishedAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
    duplicateOfIndex: 1,
  },
  {
    sourceName: "[DEMO] Báo Công an Nhân dân",
    sourceUrl: "https://example.com/bao-cand/tin-2",
    trustLevel: "verified_press",
    summary: "Phát hiện nhóm đối tượng gây rối trật tự công cộng tại khu vực Buôn Hồ.",
    rawSnippet: "Sáng nay, lực lượng chức năng đã có mặt để xử lý...",
    wardTenXa: "Buôn Hồ",
    detectedCategory: "gay_roi_trat_tu",
    publishedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
  },
  {
    sourceName: "[DEMO] Zalo — Nhóm an ninh khu phố",
    sourceUrl: null,
    trustLevel: "unverified_social",
    summary: "Cảnh báo lừa đảo qua điện thoại giả danh công an tại khu vực.",
    rawSnippet: "có người gọi điện giả công an đòi chuyển tiền, mọi người cảnh giác...",
    wardTenXa: null,
    detectedCategory: "lua_dao",
    publishedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
  },
];

export async function seedSignals(prisma: PrismaClient, signals: SeedSignalSpec[] = SEED_SIGNALS): Promise<void> {
  const createdIds: string[] = [];

  for (const spec of signals) {
    const district = spec.wardTenXa ? await prisma.district.findFirst({ where: { tenXa: spec.wardTenXa } }) : null;
    const row = await prisma.socialMediaSignal.create({
      data: {
        sourceName: spec.sourceName,
        sourceUrl: spec.sourceUrl ?? null,
        trustLevel: spec.trustLevel,
        summary: spec.summary,
        rawSnippet: spec.rawSnippet,
        districtId: district?.id ?? null,
        detectedCategory: spec.detectedCategory,
        publishedAt: spec.publishedAt,
        duplicateOfId: spec.duplicateOfIndex !== undefined ? createdIds[spec.duplicateOfIndex] : null,
      },
    });
    createdIds.push(row.id);
    // eslint-disable-next-line no-console
    console.log(`[seed-signals] ${spec.sourceName} (${spec.trustLevel}) -> ${spec.wardTenXa ?? "không rõ địa bàn"}`);
  }
}
