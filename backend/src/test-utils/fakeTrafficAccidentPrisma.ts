import { randomUUID } from "node:crypto";

export interface FakeCameraRow {
  id: string;
  districtId: string | null;
}

export interface FakeAssignment {
  officerId: string;
  districtId: string;
  isActive: boolean;
}

export interface FakeAlertRow {
  id: string;
  cameraId: string;
  districtId: string | null;
  assignedOfficerId: string | null;
  plateNumbers: string | null;
  thumbnailUrl: string | null;
  status: "pending" | "confirmed" | "dismissed";
  detectedAt: Date;
  confirmedAt: Date | null;
  confirmedByOfficerId: string | null;
}

/** Fake Prisma for trafficAccidentAlerts.service.ts: camera (findUnique), alert
 * (create/findUnique/findMany/update), officerDistrictAssignment (districtScope +
 * assignOfficer). */
export function createFakeTrafficAccidentPrisma() {
  const cameras = new Map<string, FakeCameraRow>();
  const assignments: FakeAssignment[] = [];
  const alerts = new Map<string, FakeAlertRow>();

  return {
    store: { cameras, assignments, alerts },
    seedCamera(camera: FakeCameraRow) {
      cameras.set(camera.id, camera);
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
      async findFirst({ where }: any) {
        return (
          assignments.find((a) => a.districtId === where.districtId && (where.isActive === undefined || a.isActive === where.isActive)) ?? null
        );
      },
    },
    camera: {
      async findUnique({ where }: any) {
        return cameras.get(where.id) ?? null;
      },
    },
    trafficAccidentAlert: {
      async create({ data }: any) {
        const row: FakeAlertRow = {
          id: randomUUID(),
          status: "pending",
          confirmedAt: null,
          confirmedByOfficerId: null,
          thumbnailUrl: null,
          plateNumbers: null,
          ...data,
        };
        alerts.set(row.id, row);
        return row;
      },
      async findUnique({ where, include }: any) {
        const row = alerts.get(where.id);
        if (!row) return null;
        if (include?.camera) {
          return { ...row, camera: cameras.get(row.cameraId) ?? null };
        }
        return row;
      },
      async findMany({ where, select, orderBy }: any) {
        let rows = [...alerts.values()];
        if (where?.districtId?.in) rows = rows.filter((r) => r.districtId && where.districtId.in.includes(r.districtId));
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        if (orderBy?.detectedAt === "desc") rows = rows.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
        if (!select) return rows;
        return rows.map((row) => {
          const out: any = {};
          for (const key of Object.keys(select)) if (select[key]) out[key] = (row as any)[key];
          return out;
        });
      },
      async update({ where, data }: any) {
        const row = alerts.get(where.id);
        if (!row) throw new Error("not found");
        const updated = { ...row, ...data };
        alerts.set(where.id, updated);
        return updated;
      },
    },
  };
}

export type FakeTrafficAccidentPrisma = ReturnType<typeof createFakeTrafficAccidentPrisma>;
