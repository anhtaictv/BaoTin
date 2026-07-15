import { randomUUID } from "node:crypto";

export interface FakeReportRow {
  id: string;
  districtId: string | null;
  lat: number;
  lng: number;
}

export interface FakeCameraRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  managingUnitName: string | null;
  managingUnitContact: string | null;
}

export interface FakeAssignment {
  officerId: string;
  districtId: string;
  isActive: boolean;
}

/** Haversine distance in meters — close enough to PostGIS geography ST_Distance for tests. */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pick<T extends object>(obj: T, select: Record<string, boolean>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(select) as (keyof T)[]) {
    if (select[key as string]) out[key] = obj[key];
  }
  return out;
}

/**
 * Fake Prisma for cameraExtraction.service.ts: report (findUnique, districtId+lat/lng),
 * camera (findUnique), cameraExtractionRequest (create/findMany), officerDistrictAssignment
 * (for districtScope), plus a $queryRaw that approximates the real ST_DWithin/ST_Distance
 * nearby-cameras query using haversine distance.
 */
export function createFakeCameraPrisma() {
  const reports = new Map<string, FakeReportRow>();
  const cameras = new Map<string, FakeCameraRow>();
  const assignments: FakeAssignment[] = [];
  const extractionRequests: any[] = [];

  return {
    store: { reports, cameras, assignments, extractionRequests },
    seedReport(report: FakeReportRow) {
      reports.set(report.id, report);
    },
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
    },
    report: {
      async findUnique({ where, select }: any) {
        const row = reports.get(where.id);
        if (!row) return null;
        return select ? pick(row, select) : row;
      },
    },
    camera: {
      async findUnique({ where }: any) {
        return cameras.get(where.id) ?? null;
      },
    },
    cameraExtractionRequest: {
      async create({ data }: any) {
        const row = { id: randomUUID(), status: "pending", createdAt: new Date(), ...data };
        extractionRequests.push(row);
        return row;
      },
      async findMany({ where, include }: any) {
        const rows = extractionRequests
          .filter((r) => r.reportId === where.reportId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (include?.camera) {
          return rows.map((r) => ({ ...r, camera: pick(cameras.get(r.cameraId)!, { id: true, name: true }) }));
        }
        return rows;
      },
    },
    async $queryRaw(_strings: TemplateStringsArray, ...values: unknown[]) {
      const [reportId, radiusMeters] = values as [string, number];
      const report = reports.get(reportId);
      if (!report) return [];
      return [...cameras.values()]
        .map((c) => ({
          id: c.id,
          name: c.name,
          managingUnitName: c.managingUnitName,
          managingUnitContact: c.managingUnitContact,
          distanceMeters: distanceMeters(report, c),
        }))
        .filter((c) => c.distanceMeters <= radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    },
  };
}

export type FakeCameraPrisma = ReturnType<typeof createFakeCameraPrisma>;
