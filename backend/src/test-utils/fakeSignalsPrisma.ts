export interface FakeSignal {
  id: string;
  sourceName: string | null;
  sourceUrl: string | null;
  trustLevel: string;
  summary: string | null;
  districtId: string | null;
  detectedCategory: string | null;
  publishedAt: Date | null;
  crawledAt: Date;
  duplicateOfId: string | null;
}

export interface FakeAssignment {
  officerId: string;
  districtId: string;
  isActive: boolean;
}

export interface FakeSignalReport {
  id: string;
  source: string;
  districtId: string | null;
  category: string | null;
  status: string;
  urgency: string;
  createdAt: Date;
}

export interface FakeSignalDistrict {
  id: string;
  tenXa: string;
}

/** Fake Prisma covering signals.service.ts + districtScope.ts's needs. */
export function createFakeSignalsPrisma() {
  const signals = new Map<string, FakeSignal>();
  const assignments: FakeAssignment[] = [];
  const reports = new Map<string, FakeSignalReport>();
  const districts = new Map<string, FakeSignalDistrict>();

  return {
    store: { signals, assignments, reports, districts },
    seedSignal(signal: FakeSignal) {
      signals.set(signal.id, signal);
    },
    seedAssignment(assignment: FakeAssignment) {
      assignments.push(assignment);
    },
    seedReport(report: FakeSignalReport) {
      reports.set(report.id, report);
    },
    seedDistrict(district: FakeSignalDistrict) {
      districts.set(district.id, district);
    },
    officerDistrictAssignment: {
      async findMany({ where }: any) {
        return assignments
          .filter((a) => a.officerId === where.officerId && (where.isActive === undefined || a.isActive === where.isActive))
          .map((a) => ({ districtId: a.districtId }));
      },
    },
    socialMediaSignal: {
      async findMany({ where, select }: any) {
        return [...signals.values()]
          .filter((s) => {
            if (typeof where.districtId === "string" && s.districtId !== where.districtId) return false;
            if (where.districtId?.in && !where.districtId.in.includes(s.districtId)) return false;
            if (where.districtId?.not === null && s.districtId === null) return false;
            if (where.trustLevel && s.trustLevel !== where.trustLevel) return false;
            if (where.detectedCategory && s.detectedCategory !== where.detectedCategory) return false;
            return true;
          })
          .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
          .map((s) => (select ? pick(s, select) : s));
      },
      async findUnique({ where }: any) {
        return signals.get(where.id) ?? null;
      },
    },
    report: {
      async findMany({ where, select }: any) {
        return [...reports.values()]
          .filter((r) => {
            if (where.source && r.source !== where.source) return false;
            if (where.districtId !== undefined && r.districtId !== where.districtId) return false;
            if (where.createdAt?.gte && r.createdAt < where.createdAt.gte) return false;
            if (where.createdAt?.lte && r.createdAt > where.createdAt.lte) return false;
            return true;
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => (select ? pick(r, select) : r));
      },
    },
    district: {
      async findUnique({ where, select }: any) {
        const district = districts.get(where.id);
        return district ? (select ? pick(district, select) : district) : null;
      },
    },
  };
}

function pick<T extends object>(obj: T, select: Record<string, boolean>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(select) as (keyof T)[]) {
    if (select[key as string]) out[key] = obj[key];
  }
  return out;
}

export type FakeSignalsPrisma = ReturnType<typeof createFakeSignalsPrisma>;
