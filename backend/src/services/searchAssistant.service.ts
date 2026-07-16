import type { PrismaClient } from "@prisma/client";
import type { QueryInterpreter } from "./searchInterpreter.js";

export interface SearchAssistantDeps {
  prisma: PrismaClient;
  interpreter: QueryInterpreter;
}

const REPORT_RESULT_SELECT = {
  id: true,
  category: true,
  status: true,
  urgency: true,
  districtId: true,
  description: true,
  createdAt: true,
} as const;

const SIGNAL_RESULT_SELECT = {
  id: true,
  sourceName: true,
  trustLevel: true,
  summary: true,
  detectedCategory: true,
  districtId: true,
  publishedAt: true,
} as const;

const MAX_RESULTS = 50;

/**
 * Trợ lý tìm kiếm ngôn ngữ tự nhiên (admin/senior_officer, dashboard-web). The model is used
 * ONLY to turn the question into structured filters (searchInterpreter.ts) — every result
 * returned here comes from a real query against `reports`/`social_media_signals`, never from
 * the model's own text. This keeps the guarantee that nothing here can hallucinate a report or
 * signal that doesn't exist, and Signal/Report results stay in separate lists (CLAUDE.md #1/#2)
 * rather than being merged into one blended list.
 */
export function createSearchAssistantService(deps: SearchAssistantDeps) {
  async function search(query: string) {
    const districts = await deps.prisma.district.findMany({ select: { id: true, tenXa: true } });
    const interpretation = await deps.interpreter.interpret(
      query,
      districts.map((d) => d.tenXa),
    );

    if (!interpretation) {
      return { available: false as const, interpreted: null, reports: [], signals: [] };
    }

    const matchedDistrict = interpretation.districtName
      ? districts.find((d) => d.tenXa.toLowerCase() === interpretation.districtName!.toLowerCase())
      : undefined;
    const since = interpretation.sinceDays
      ? new Date(Date.now() - interpretation.sinceDays * 24 * 60 * 60 * 1000)
      : undefined;
    const keyword = interpretation.keyword?.trim() || undefined;

    const reports = await deps.prisma.report.findMany({
      where: {
        source: "citizen",
        ...(matchedDistrict ? { districtId: matchedDistrict.id } : {}),
        ...(since ? { createdAt: { gte: since } } : {}),
        ...(keyword
          ? {
              OR: [
                { description: { contains: keyword, mode: "insensitive" } },
                { category: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: REPORT_RESULT_SELECT,
      orderBy: { createdAt: "desc" },
      take: MAX_RESULTS,
    });

    const signals = await deps.prisma.socialMediaSignal.findMany({
      where: {
        ...(matchedDistrict ? { districtId: matchedDistrict.id } : {}),
        ...(since ? { publishedAt: { gte: since } } : {}),
        ...(keyword
          ? {
              OR: [
                { summary: { contains: keyword, mode: "insensitive" } },
                { detectedCategory: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: SIGNAL_RESULT_SELECT,
      orderBy: { publishedAt: "desc" },
      take: MAX_RESULTS,
    });

    return {
      available: true as const,
      interpreted: {
        districtName: matchedDistrict?.tenXa ?? null,
        sinceDays: interpretation.sinceDays ?? null,
        keyword: keyword ?? null,
      },
      reports,
      signals,
    };
  }

  return { search };
}

export type SearchAssistantService = ReturnType<typeof createSearchAssistantService>;
