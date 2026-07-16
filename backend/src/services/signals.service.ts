import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";
import { computeHeatByDistrict, HEAT_LOOKBACK_DAYS, type SignalHeat } from "./signalHeat.js";
import { NoopHeatNarrator, type HeatNarrator } from "./heatNarrative.js";

export interface ListSignalsFilters {
  districtId?: string;
  trustLevel?: string;
  category?: string;
}

export interface SignalsDeps {
  prisma: PrismaClient;
  districtScope: DistrictScopeService;
  /** Optional AI narrative for the detail view when heat is medium/high. Defaults to
   * NoopHeatNarrator (heat badge only, no narrative text) when not given. */
  heatNarrator?: HeatNarrator;
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
  const heatNarrator = deps.heatNarrator ?? new NoopHeatNarrator();

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
      return { ...signal, heat: null, heatNarrative: null, relatedReports: [] };
    }

    const heatByDistrict = await computeHeatForScope([signal.districtId]);
    const heat = heatByDistrict.get(signal.districtId) ?? { score: 0, level: "low" as const };
    const heatNarrative = heat.level === "low" ? null : await buildHeatNarrative(signal.districtId);

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

    return { ...signal, heat, heatNarrative, relatedReports };
  }

  /** Only called when heat is medium/high — builds the narrative from the same signals that
   * drove the heat count (district-scoped, 14-day lookback — same effectiveDate rule as
   * computeHeatByDistrict in signalHeat.ts), so the text describes exactly what the badge is
   * reacting to, nothing more. Filters in JS rather than via a DB where-clause to reuse the
   * exact same date logic instead of restating it as a second, possibly-diverging query shape. */
  async function buildHeatNarrative(districtId: string): Promise<string | null> {
    const since = new Date(Date.now() - HEAT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const districtSignals = await deps.prisma.socialMediaSignal.findMany({
      where: { districtId },
      select: { summary: true, detectedCategory: true, publishedAt: true, crawledAt: true },
      orderBy: { publishedAt: "desc" },
    });
    const recentSignals = districtSignals
      .filter((s) => (s.publishedAt ?? s.crawledAt) >= since)
      .slice(0, 10)
      .map((s) => ({ summary: s.summary, detectedCategory: s.detectedCategory }));

    const district = await deps.prisma.district.findUnique({ where: { id: districtId }, select: { tenXa: true } });
    return heatNarrator.generate({ districtName: district?.tenXa ?? "khu vực này", signals: recentSignals });
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
