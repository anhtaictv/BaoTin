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

/** Fake Prisma covering signals.service.ts + districtScope.ts's needs. */
export function createFakeSignalsPrisma() {
  const signals = new Map<string, FakeSignal>();
  const assignments: FakeAssignment[] = [];

  return {
    store: { signals, assignments },
    seedSignal(signal: FakeSignal) {
      signals.set(signal.id, signal);
    },
    seedAssignment(assignment: FakeAssignment) {
      assignments.push(assignment);
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
            if (where.districtId?.in && !where.districtId.in.includes(s.districtId)) return false;
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
