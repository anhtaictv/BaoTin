export interface FakeDashboardReport {
  id: string;
  source: string;
  districtId: string | null;
  assignedOfficerId: string | null;
  status: string;
  urgency: string;
  responseTimeSeconds: number | null;
  createdAt: Date;
}

export interface FakeDashboardDistrict {
  id: string;
  tenXa: string;
}

export interface FakeDashboardOfficer {
  id: string;
  fullNameEnc: string;
  unitName: string | null;
}

export interface FakeCameraExtractionRequestRow {
  id: string;
  status: string;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function pick<T extends object>(obj: T, select: Record<string, boolean>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(select) as (keyof T)[]) {
    if (select[key as string]) out[key] = obj[key];
  }
  return out;
}

function matchesWhere(row: FakeDashboardReport, where: Record<string, any>): boolean {
  if (where.source && row.source !== where.source) return false;
  if (where.createdAt?.gte && row.createdAt < where.createdAt.gte) return false;
  if (typeof where.districtId === "string" && row.districtId !== where.districtId) return false;
  if (where.districtId?.not === null && row.districtId === null) return false;
  if (where.assignedOfficerId?.not === null && row.assignedOfficerId === null) return false;
  if (where.responseTimeSeconds?.not === null && row.responseTimeSeconds === null) return false;
  return true;
}

/**
 * Fake Prisma for dashboardStats.service.ts: report.count/groupBy/aggregate, district/officer
 * findMany (id-in lookups), cameraExtractionRequest.groupBy, and a $queryRaw approximating
 * the real per-day volume-trend query. Only supports the exact shapes that service calls.
 */
export function createFakeDashboardPrisma() {
  const reports: FakeDashboardReport[] = [];
  const districts: FakeDashboardDistrict[] = [];
  const officers: FakeDashboardOfficer[] = [];
  const extractionRequests: FakeCameraExtractionRequestRow[] = [];

  return {
    store: { reports, districts, officers, extractionRequests },
    seedReport(row: FakeDashboardReport) {
      reports.push(row);
    },
    seedDistrict(row: FakeDashboardDistrict) {
      districts.push(row);
    },
    seedOfficer(row: FakeDashboardOfficer) {
      officers.push(row);
    },
    seedExtractionRequest(row: FakeCameraExtractionRequestRow) {
      extractionRequests.push(row);
    },
    report: {
      async count({ where }: any) {
        return reports.filter((r) => matchesWhere(r, where ?? {})).length;
      },
      async groupBy({ by, where, _avg, _count }: any) {
        const field = by[0] as keyof FakeDashboardReport;
        const filtered = reports.filter((r) => matchesWhere(r, where ?? {}));
        const groups = new Map<string, FakeDashboardReport[]>();
        for (const row of filtered) {
          const key = String(row[field]);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(row);
        }
        return [...groups.values()].map((rows) => {
          const result: Record<string, unknown> = { [field]: rows[0]![field] };
          if (_avg?.responseTimeSeconds) {
            result._avg = {
              responseTimeSeconds: average(
                rows.map((r) => r.responseTimeSeconds).filter((v): v is number => v !== null),
              ),
            };
          }
          if (_count) result._count = rows.length;
          return result;
        });
      },
      async aggregate({ where, _avg }: any) {
        const filtered = reports.filter((r) => matchesWhere(r, where ?? {}));
        if (_avg?.responseTimeSeconds) {
          return {
            _avg: {
              responseTimeSeconds: average(
                filtered.map((r) => r.responseTimeSeconds).filter((v): v is number => v !== null),
              ),
            },
          };
        }
        return { _avg: {} };
      },
    },
    district: {
      async findMany({ where, select }: any) {
        // where?.id?.in narrows to a specific set (getResponseTimeByDistrict); no `where`
        // at all means "list everything" (getDistrictOptions, for the filter dropdown).
        const rows = where?.id?.in ? districts.filter((d) => where.id.in.includes(d.id)) : districts;
        return [...rows].sort((a, b) => a.tenXa.localeCompare(b.tenXa)).map((d) => (select ? pick(d, select) : d));
      },
    },
    officer: {
      async findMany({ where, select }: any) {
        const ids: string[] = where?.id?.in ?? [];
        return officers.filter((o) => ids.includes(o.id)).map((o) => (select ? pick(o, select) : o));
      },
    },
    cameraExtractionRequest: {
      async groupBy({ by, _count }: any) {
        const field = by[0] as keyof FakeCameraExtractionRequestRow;
        const groups = new Map<string, number>();
        for (const row of extractionRequests) {
          const key = String(row[field]);
          groups.set(key, (groups.get(key) ?? 0) + 1);
        }
        return [...groups.entries()].map(([key, count]) => ({ [field]: key, _count: _count ? count : undefined }));
      },
    },
    async $queryRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
      const days = values[0] as number;
      const districtId = values[1] as string | undefined;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const filtered = reports.filter(
        (r) =>
          r.source === "citizen" &&
          r.createdAt >= since &&
          (districtId === undefined || r.districtId === districtId),
      );
      const byDate = new Map<string, number>();
      for (const row of filtered) {
        const dateStr = row.createdAt.toISOString().slice(0, 10);
        byDate.set(dateStr, (byDate.get(dateStr) ?? 0) + 1);
      }
      return [...byDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, count]) => ({ date, count: BigInt(count) }));
    },
  };
}

export type FakeDashboardPrisma = ReturnType<typeof createFakeDashboardPrisma>;
