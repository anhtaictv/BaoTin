import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";

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

    return deps.prisma.socialMediaSignal.findMany({
      where: {
        ...(districtIdFilter ? { districtId: { in: districtIdFilter } } : {}),
        ...(filters.trustLevel ? { trustLevel: filters.trustLevel as never } : {}),
        ...(filters.category ? { detectedCategory: filters.category } : {}),
      },
      select: SIGNAL_LIST_SELECT,
      orderBy: { publishedAt: "desc" },
    });
  }

  async function getSignalDetail(subject: DistrictScopeSubject, signalId: string) {
    const signal = await deps.prisma.socialMediaSignal.findUnique({ where: { id: signalId } });
    if (!signal) throw new HttpError(404, "SIGNAL_NOT_FOUND", "Không tìm thấy tín hiệu.");
    await deps.districtScope.assertDistrictAccess(subject, signal.districtId);
    return signal;
  }

  return { listSignals, getSignalDetail };
}

export type SignalsService = ReturnType<typeof createSignalsService>;
