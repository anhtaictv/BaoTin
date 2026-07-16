import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";
import { computeHeatByDistrict, type SignalHeat } from "./signalHeat.js";

export interface ListSignalsFilters {
  districtId?: string;
  trustLevel?: string;
  category?: string;
}

export interface SignalsDeps {
  prisma: PrismaClient;
  districtScope: DistrictScopeService;
}

const SIGNAL_LIST_SELECT = {
  id: true,
  sourceName: true,
  sourceUrl: true,
  trustLevel: true,
  summary: true,
  districtId: true,
  detectedCategory: true,
  publishedAt: true,
  crawledAt: true,
  duplicateOfId: true,
} as const;

const RELATED_REPORT_SELECT = {
  id: true,
  category: true,
  status: true,
  urgency: true,
  createdAt: true,
} as const;

/** Giai đoạn 3 "đối chiếu chéo" window — a citizen report within this many days of the
 * signal's publish date might be about the same event. Purely informational (never an
 * automatic conclusion) — the officer decides whether they're actually related. */
const RELATED_REPORT_WINDOW_DAYS = 3;

/**
 * Giai đoạn 2 "kênh tình báo mở" — strictly read-only. No function here ever writes to
 * `reports` or flips a Signal into anything resembling a verified case (CLAUDE.md #1/#2):
 * that conversion, if it ever happens, is a human officer filing a *new* Report themselves.
 * District scoping mirrors officerReports.service.ts exactly — a regular officer sees only
 * signals in their assigned district(s), senior_officer/admin see everything.
 */
export function createSignalsService(deps: SignalsDeps) {
  async function listSignals(subject: DistrictScopeSubject, filters: ListSignalsFilters) {
    const isUnrestricted = subject.role === "senior_officer" || subject.role === "admin";
    let districtIdFilter: string[] | undefined;

    if (isUnrestricted) {
      districtIdFilter = filters.districtId ? [filters.districtId] : undefined;
    } else {
      const allowed = await deps.districtScope.getAllowedDistrictIds(subject.id);
      if (filters.districtId && !allowed.includes(filters.districtId)) {
        throw new HttpError(403, "FORBIDDEN", "Không có quyền truy cập tín hiệu thuộc địa bàn này.");
      }
      districtIdFilter = filters.districtId ? [filters.districtId] : allowed;
    }

    const signals = await deps.prisma.socialMediaSignal.findMany({
      where: {
        ...(districtIdFilter ? { districtId: { in: districtIdFilter } } : {}),
        ...(filters.trustLevel ? { trustLevel: filters.trustLevel as never } : {}),
        ...(filters.category ? { detectedCategory: filters.category } : {}),
      },
      select: SIGNAL_LIST_SELECT,
      orderBy: { publishedAt: "desc" },
    });

    const heatByDistrict = await computeHeatForScope(districtIdFilter);
    return signals.map((signal) => ({
      ...signal,
      heat: signal.districtId ? (heatByDistrict.get(signal.districtId) ?? { score: 0, level: "low" as const }) : null,
    }));
  }

  async function getSignalDetail(subject: DistrictScopeSubject, signalId: string) {
    const signal = await deps.prisma.socialMediaSignal.findUnique({ where: { id: signalId } });
    if (!signal) throw new HttpError(404, "SIGNAL_NOT_FOUND", "Không tìm thấy tín hiệu.");
    await deps.districtScope.assertDistrictAccess(subject, signal.districtId);

    if (!signal.districtId) {
      return { ...signal, heat: null, relatedReports: [] };
    }

    const heatByDistrict = await computeHeatForScope([signal.districtId]);
    const heat = heatByDistrict.get(signal.districtId) ?? { score: 0, level: "low" as const };

    const effectiveDate = signal.publishedAt ?? signal.crawledAt;
    const windowMs = RELATED_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const relatedReports = await deps.prisma.report.findMany({
      where: {
        source: "citizen",
        districtId: signal.districtId,
        createdAt: {
          gte: new Date(effectiveDate.getTime() - windowMs),
          lte: new Date(effectiveDate.getTime() + windowMs),
        },
      },
      select: RELATED_REPORT_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return { ...signal, heat, relatedReports };
  }

  /** Heat is computed across every signal in scope (not just the ones matching the caller's
   * trustLevel/category filters) — a "low" filtered view shouldn't make a genuinely hot area
   * look quiet just because this particular query excluded the press articles driving it. */
  async function computeHeatForScope(districtIdFilter?: string[]): Promise<Map<string, SignalHeat>> {
    const rows = await deps.prisma.socialMediaSignal.findMany({
      where: { districtId: districtIdFilter ? { in: districtIdFilter } : { not: null } },
      select: { districtId: true, crawledAt: true, publishedAt: true },
    });
    return computeHeatByDistrict(rows);
  }

  return { listSignals, getSignalDetail };
}

export type SignalsService = ReturnType<typeof createSignalsService>;
