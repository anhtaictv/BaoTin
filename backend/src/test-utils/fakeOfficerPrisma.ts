import { randomUUID } from "node:crypto";

export interface FakeReportUser {
  id: string;
  isAnonymousPublic: boolean;
  phoneNumberEnc?: string;
  phoneHash?: string;
  fullNameEnc?: string | null;
}

export interface FakeReport {
  id: string;
  category: string | null;
  urgency: string;
  status: string;
  source: string;
  districtId: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
  responseTimeSeconds: number | null;
  userId?: string | null;
  user?: FakeReportUser;
  /** location isn't a real Prisma field (PostGIS Unsupported) — see $queryRaw stub below. */
  lat?: number;
  lng?: number;
}

export interface FakeAssignment {
  officerId: string;
  districtId: string;
  isActive: boolean;
}

/**
 * Fake Prisma covering officerReports.service.ts + districtScope.ts's needs:
 * officerDistrictAssignment, report (findMany/findUnique/update), reportStatusHistory,
 * officialCaseLink, plus $transaction. Lets district-scoping and status-transition
 * logic be exercised without a live Postgres connection.
 */
export function createFakeOfficerPrisma() {
  const reports = new Map<string, FakeReport>();
  const assignments: FakeAssignment[] = [];
  const statusHistory: any[] = [];
  const officialCaseLinks: any[] = [];
  const auditLogEntries: any[] = [];

  return {
    store: { reports, assignments, statusHistory, officialCaseLinks, auditLogEntries },
    seedReport(report: FakeReport) {
      reports.set(report.id, report);
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
    report: {
      async findMany({ where, select }: any) {
        return [...reports.values()]
          .filter((r) => {
            if (where.source && r.source !== where.source) return false;
            if (where.districtId?.in && !where.districtId.in.includes(r.districtId)) return false;
            if (where.status && r.status !== where.status) return false;
            if (where.urgency && r.urgency !== where.urgency) return false;
            return true;
          })
          .map((r) => (select ? pick(r, select) : r));
      },
      async findUnique({ where }: any) {
        const found = reports.get(where.id);
        // include: { attachments: true } always expects an array back — default to empty
        // so getReportDetail's report.attachments.map(...) doesn't need a seeded value.
        return found ? { attachments: [], ...found } : null;
      },
      async update({ where, data }: any) {
        const existing = reports.get(where.id);
        if (!existing) throw new Error("report not found");
        // Replace rather than mutate-in-place: real Prisma never retroactively mutates a
        // plain object an earlier findUnique() already returned to the caller. Mutating
        // the shared reference here previously caused a false "oldStatus" bug — see the
        // reportStatusHistory.create() call in officerReports.service.ts, which reads
        // `report.status` captured *before* this update runs.
        const updated = { ...existing, ...data };
        reports.set(where.id, updated);
        return updated;
      },
    },
    reportStatusHistory: {
      async create({ data }: any) {
        const row = { id: randomUUID(), changedAt: new Date(), ...data };
        statusHistory.push(row);
        return row;
      },
    },
    officialCaseLink: {
      async create({ data }: any) {
        const row = { id: randomUUID(), linkedAt: new Date(), ...data };
        officialCaseLinks.push(row);
        return row;
      },
    },
    adminAuditLog: {
      async create({ data }: any) {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        auditLogEntries.push(row);
        return row;
      },
    },
    async $transaction(ops: Promise<unknown>[]) {
      return Promise.all(ops);
    },
    // Mimics the ST_Y/ST_X-by-id raw query in officerReports.service.ts's getReportDetail —
    // the report's id is the only interpolated value in that template.
    async $queryRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
      const reportId = values[0] as string;
      const report = reports.get(reportId);
      if (!report) return [];
      return [{ lat: report.lat ?? 12.66, lng: report.lng ?? 108.05 }];
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

export type FakeOfficerPrisma = ReturnType<typeof createFakeOfficerPrisma>;
