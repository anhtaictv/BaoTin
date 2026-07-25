import { randomUUID } from "node:crypto";

interface FakeReportRow {
  id: string;
  userId: string;
  category: string;
  urgency: string;
  description: string | null;
  lng: number;
  lat: number;
  locationSource: string | null;
  districtId: string | null;
  assignedOfficerId: string | null;
  status: string;
  createdAt: Date;
  verifiedAt: Date | null;
  responseTimeSeconds: number | null;
}

interface FakeStatusHistoryRow {
  id: string;
  reportId: string;
  oldStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  note: string | null;
  changedAt: Date;
}

function pick<T extends object>(obj: T, select?: Record<string, boolean>): Partial<T> {
  if (!select) return obj;
  const out: Partial<T> = {};
  for (const key of Object.keys(select) as (keyof T)[]) {
    if (select[key as string]) out[key] = obj[key];
  }
  return out;
}

/**
 * Fake Prisma covering exactly what reportLifecycle.service.ts calls: the raw-SQL insert
 * (matched positionally to insertReportRow's ${...} interpolation order) plus the plain
 * Prisma calls for reportAttachment/report. Lets us exercise real geo-matching wiring,
 * attachment persistence, and read-back logic without a live Postgres connection.
 */
export function createFakeReportPrisma() {
  const reports: FakeReportRow[] = [];
  const attachments: any[] = [];
  const statusHistory: FakeStatusHistoryRow[] = [];
  const officers: { id: string; role: string }[] = [];

  return {
    store: { reports, attachments, statusHistory, officers },
    seedOfficer(officer: { id: string; role: string }) {
      officers.push(officer);
    },
    officer: {
      async findMany({ where }: any) {
        return officers.filter((o) => !where?.role || o.role === where.role).map((o) => ({ id: o.id }));
      },
    },
    async $executeRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
      const [reportId, userId, category, urgency, description, lng, lat, locationSource, districtId, assignedOfficerId] =
        values as [string, string, string, string, string | null, number, number, string | null, string | null, string | null];
      reports.push({
        id: reportId,
        userId,
        category,
        urgency,
        description,
        lng,
        lat,
        locationSource,
        districtId,
        assignedOfficerId,
        status: "pending",
        createdAt: new Date(),
        verifiedAt: null,
        responseTimeSeconds: null,
      });
      return 1;
    },
    reportAttachment: {
      async create({ data }: any) {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        attachments.push(row);
        return row;
      },
    },
    report: {
      async findMany({ where, select }: any) {
        return reports
          .filter((r) => r.userId === where.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => pick(r, select));
      },
      async findFirst({ where, select }: any) {
        const row = reports.find((r) => r.id === where.id && r.userId === where.userId);
        return row ? pick(row, select) : null;
      },
    },
    reportStatusHistory: {
      async findFirst({ where, select }: any) {
        const matches = statusHistory
          .filter((h) => h.reportId === where.reportId)
          .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
        const row = matches[0];
        return row ? pick(row, select) : null;
      },
    },
  };
}

export type FakeReportPrisma = ReturnType<typeof createFakeReportPrisma>;
