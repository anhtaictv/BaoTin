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
  districtId?: string | null;
  directionDegrees?: number | null;
  fovDegrees?: number | null;
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

/** Forward compass bearing (0-359, 0 = Bắc, clockwise) from `a` to `b` — matches PostGIS
 * ST_Azimuth's convention, which the real nearbyCameras query uses. */
function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
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
  const districts = new Set<string>();
  const assignments: FakeAssignment[] = [];
  const extractionRequests: any[] = [];

  return {
    store: { reports, cameras, districts, assignments, extractionRequests },
    seedReport(report: FakeReportRow) {
      reports.set(report.id, report);
    },
    seedCamera(camera: FakeCameraRow) {
      cameras.set(camera.id, camera);
    },
    /** createCamera/updateCamera's assertDistrictExists checks this — tests that go through
     * either must seed the districtId they use, same as a real district row would need to exist. */
    seedDistrict(districtId: string) {
      districts.add(districtId);
    },
    seedAssignment(assignment: FakeAssignment) {
      assignments.push(assignment);
    },
    district: {
      async findUnique({ where }: any) {
        return districts.has(where.id) ? { id: where.id } : null;
      },
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
      async delete({ where }: any) {
        const row = cameras.get(where.id);
        cameras.delete(where.id);
        return row;
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
      async count({ where }: any) {
        return extractionRequests.filter((r) => r.cameraId === where.cameraId).length;
      },
    },
    trafficAccidentAlert: {
      async count() {
        return 0;
      },
    },
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join(" ");

      // listDistrictCameras: no "reports" join, filters (or not) by district_id.
      if (!sql.includes("FROM cameras c, reports r")) {
        const [districtIds] = values as [string[]?];
        const rows = [...cameras.values()].filter(
          (c) => districtIds === undefined || districtIds.includes(c.districtId ?? ""),
        );
        return rows
          .map((c) => ({
            id: c.id,
            name: c.name,
            lat: c.lat,
            lng: c.lng,
            managingUnitName: c.managingUnitName,
            managingUnitContact: c.managingUnitContact,
            districtId: c.districtId ?? null,
            directionDegrees: c.directionDegrees ?? null,
            fovDegrees: c.fovDegrees ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // nearbyCameras
      const [reportId, radiusMeters] = values as [string, number];
      const report = reports.get(reportId);
      if (!report) return [];
      return [...cameras.values()]
        .map((c) => {
          const dist = distanceMeters(report, c);
          return {
            id: c.id,
            name: c.name,
            lat: c.lat,
            lng: c.lng,
            managingUnitName: c.managingUnitName,
            managingUnitContact: c.managingUnitContact,
            directionDegrees: c.directionDegrees ?? null,
            fovDegrees: c.fovDegrees ?? null,
            distanceMeters: dist,
            bearingToReportDegrees: dist < 1 ? null : bearingDegrees(c, report),
          };
        })
        .filter((c) => c.distanceMeters <= radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    },
    // Mirrors cameraExtraction.service.ts's createCamera/updateCamera raw INSERT/UPDATE —
    // the positional `values` order here must match those queries' interpolation order
    // exactly (both are written in this same codebase, kept in lockstep).
    async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join(" ");

      if (sql.includes("INSERT INTO cameras")) {
        const [id, name, lng, lat, managingUnitName, managingUnitContact, districtId, directionDegrees, fovDegrees] =
          values as [string, string, number, number, string | null, string | null, string, number | null, number | null];
        cameras.set(id, { id, name, lat, lng, managingUnitName, managingUnitContact, districtId, directionDegrees, fovDegrees });
        return 1;
      }

      if (sql.includes("UPDATE cameras")) {
        const [name, lng, lat, managingUnitName, managingUnitContact, districtId, directionDegrees, fovDegrees, id] =
          values as [string, number, number, string | null, string | null, string, number | null, number | null, string];
        const existing = cameras.get(id);
        if (!existing) return 0;
        cameras.set(id, { ...existing, name, lat, lng, managingUnitName, managingUnitContact, districtId, directionDegrees, fovDegrees });
        return 1;
      }

      throw new Error(`fakeCameraPrisma.$executeRaw: unrecognized query — ${sql}`);
    },
  };
}

export type FakeCameraPrisma = ReturnType<typeof createFakeCameraPrisma>;
