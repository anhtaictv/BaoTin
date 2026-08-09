import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";
import { isFacingBearing } from "../geo/cameraFacing.js";

const DEFAULT_RADIUS_METERS = 500;

export interface NearbyCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  managingUnitName: string | null;
  managingUnitContact: string | null;
  distanceMeters: number;
  directionDegrees: number | null;
  fovDegrees: number | null;
  /** null = unknown (camera has no direction data). true/false = whether the camera's own
   * facing direction + field of view actually covers this report's location, not just
   * "nearby" — see geo/cameraFacing.ts. */
  facesLocation: boolean | null;
}

export interface DistrictCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  managingUnitName: string | null;
  managingUnitContact: string | null;
  districtId: string | null;
  directionDegrees: number | null;
  fovDegrees: number | null;
}

export interface CameraInput {
  name: string;
  lat: number;
  lng: number;
  managingUnitName?: string;
  managingUnitContact?: string;
  districtId: string;
  directionDegrees?: number;
  fovDegrees?: number;
}

export interface CreateExtractionRequestInput {
  /** 1+ cameras selected in one action (e.g. several cameras along a route) — each becomes
   * its own independent request row, never a merged/cross-camera lookup. */
  cameraIds: string[];
  timeRangeStart: Date;
  timeRangeEnd: Date;
  note?: string;
}

export interface CameraExtractionDeps {
  prisma: PrismaClient;
  districtScope: DistrictScopeService;
}

/**
 * v1.1 — CLAUDE.md non-negotiable #8: this service only ever handles camera *location* and
 * *request metadata*. It never fetches, streams, stores, or analyzes video — every function
 * here either returns coordinates/contact info or writes an administrative request row.
 *
 * This is a deliberate, procedural limitation, not a technical one: cross-camera person/
 * vehicle recognition and route reconstruction would be biometric tracking, which needs its
 * own legal basis and belongs in a purpose-built police operational system — not this
 * citizen-facing incident-reporting app. Selecting several cameras along a route here (see
 * createExtractionRequest) only ever produces N independent paperwork requests for N human
 * reviewers at N managing units to act on — never an automated cross-camera match.
 */
export function createCameraExtractionService(deps: CameraExtractionDeps) {
  async function assertReportAccess(subject: DistrictScopeSubject, reportId: string): Promise<string | null> {
    const report = await deps.prisma.report.findUnique({
      where: { id: reportId },
      select: { districtId: true },
    });
    if (!report) throw new HttpError(404, "REPORT_NOT_FOUND", "Không tìm thấy tin báo.");
    await deps.districtScope.assertDistrictAccess(subject, report.districtId);
    return report.districtId;
  }

  /**
   * Auto-suggests nearby cameras — the caller (report detail screen) calls this
   * automatically on load, the officer never has to search manually. Uses PostGIS
   * ST_DWithin on ::geography casts so `radiusMeters` means real meters, not degrees.
   */
  async function nearbyCameras(
    subject: DistrictScopeSubject,
    reportId: string,
    radiusMeters: number = DEFAULT_RADIUS_METERS,
  ): Promise<NearbyCamera[]> {
    await assertReportAccess(subject, reportId);

    const rows = await deps.prisma.$queryRaw<(Omit<NearbyCamera, "facesLocation"> & { bearingToReportDegrees: number | null })[]>`
      SELECT
        c.id AS "id",
        c.name AS "name",
        ST_Y(c.location) AS "lat",
        ST_X(c.location) AS "lng",
        c.managing_unit_name AS "managingUnitName",
        c.managing_unit_contact AS "managingUnitContact",
        c.direction_degrees AS "directionDegrees",
        c.fov_degrees AS "fovDegrees",
        ST_Distance(c.location::geography, r.location::geography) AS "distanceMeters",
        CASE
          WHEN ST_DWithin(c.location::geography, r.location::geography, 1) THEN NULL
          ELSE degrees(ST_Azimuth(c.location, r.location))
        END AS "bearingToReportDegrees"
      FROM cameras c, reports r
      WHERE r.id = ${reportId}
        AND ST_DWithin(c.location::geography, r.location::geography, ${radiusMeters})
      ORDER BY "distanceMeters" ASC
    `;

    return rows.map(({ bearingToReportDegrees, ...camera }) => ({
      ...camera,
      facesLocation:
        camera.directionDegrees == null
          ? null
          : bearingToReportDegrees == null
            // Camera sits essentially on top of the report location (< 1m) — trivially
            // relevant regardless of which way it's pointed; ST_Azimuth is also undefined
            // for coincident points, so this guard avoids that edge case entirely.
            ? true
            : isFacingBearing(camera.directionDegrees, camera.fovDegrees ?? 90, bearingToReportDegrees),
    }));
  }

  /**
   * All cameras in the officer's own assigned district(s) — the standalone "Camera" map page
   * (not tied to any one report), so an officer can browse what's covering their area at any
   * time. Mirrors officerReports.service.ts's resolveDistrictFilter pattern: senior_officer/
   * admin are unrestricted and see every camera, a regular officer only ever sees their own
   * currently-assigned district(s), re-derived fresh (never trusts a stale JWT claim).
   */
  async function listDistrictCameras(subject: DistrictScopeSubject): Promise<DistrictCamera[]> {
    const isUnrestricted = subject.role === "senior_officer" || subject.role === "admin";
    if (isUnrestricted) {
      return deps.prisma.$queryRaw<DistrictCamera[]>`
        SELECT
          c.id AS "id", c.name AS "name",
          ST_Y(c.location) AS "lat", ST_X(c.location) AS "lng",
          c.managing_unit_name AS "managingUnitName", c.managing_unit_contact AS "managingUnitContact",
          c.district_id AS "districtId",
          c.direction_degrees AS "directionDegrees", c.fov_degrees AS "fovDegrees"
        FROM cameras c
        ORDER BY c.name ASC
      `;
    }

    const districtIds = await deps.districtScope.getAllowedDistrictIds(subject.id);
    if (districtIds.length === 0) return [];

    return deps.prisma.$queryRaw<DistrictCamera[]>`
      SELECT
        c.id AS "id", c.name AS "name",
        ST_Y(c.location) AS "lat", ST_X(c.location) AS "lng",
        c.managing_unit_name AS "managingUnitName", c.managing_unit_contact AS "managingUnitContact",
        c.district_id AS "districtId",
        c.direction_degrees AS "directionDegrees", c.fov_degrees AS "fovDegrees"
      FROM cameras c
      WHERE c.district_id = ANY(${districtIds})
      ORDER BY c.name ASC
    `;
  }

  function toDistrictCamera(id: string, input: CameraInput): DistrictCamera {
    return {
      id,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      managingUnitName: input.managingUnitName ?? null,
      managingUnitContact: input.managingUnitContact ?? null,
      districtId: input.districtId,
      directionDegrees: input.directionDegrees ?? null,
      fovDegrees: input.fovDegrees ?? null,
    };
  }

  /** `Camera.districtId` is a real FK (see schema.prisma's `district District? @relation(...)`)
   * — inserting/updating with a well-formed but non-existent UUID would otherwise surface as a
   * raw Postgres FK-violation 500 instead of a clear validation error. */
  async function assertDistrictExists(districtId: string): Promise<void> {
    const district = await deps.prisma.district.findUnique({ where: { id: districtId } });
    if (!district) throw new HttpError(400, "DISTRICT_NOT_FOUND", "Địa bàn không tồn tại.");
  }

  /**
   * Registers a real camera — the admin "Thêm camera" form. Route-gated to admin/senior_officer
   * only (both already bypass district scoping per districtScope.ts's UNRESTRICTED_ROLES), so
   * unlike assertReportAccess above this deliberately does not re-check district access —
   * same precedent as dashboardStats.service.ts. `location` is an Unsupported PostGIS column
   * (see schema.prisma), so the insert has to go through raw SQL — the ORM can't touch it.
   */
  async function createCamera(input: CameraInput): Promise<DistrictCamera> {
    await assertDistrictExists(input.districtId);
    const id = randomUUID();
    await deps.prisma.$executeRaw`
      INSERT INTO cameras (
        id, name, location, managing_unit_name, managing_unit_contact, district_id,
        direction_degrees, fov_degrees
      )
      VALUES (
        ${id}::uuid, ${input.name},
        ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326),
        ${input.managingUnitName ?? null}, ${input.managingUnitContact ?? null}, ${input.districtId}::uuid,
        ${input.directionDegrees ?? null}, ${input.fovDegrees ?? null}
      )
    `;
    return toDistrictCamera(id, input);
  }

  /**
   * Full replace, not a partial patch — the edit form always submits every field back
   * (pre-filled from the list it loaded from listDistrictCameras), so there's no need to
   * read-then-merge with existing DB state.
   */
  async function updateCamera(cameraId: string, input: CameraInput): Promise<DistrictCamera> {
    const existing = await deps.prisma.camera.findUnique({ where: { id: cameraId } });
    if (!existing) throw new HttpError(404, "CAMERA_NOT_FOUND", "Không tìm thấy camera.");
    await assertDistrictExists(input.districtId);

    await deps.prisma.$executeRaw`
      UPDATE cameras SET
        name = ${input.name},
        location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326),
        managing_unit_name = ${input.managingUnitName ?? null},
        managing_unit_contact = ${input.managingUnitContact ?? null},
        district_id = ${input.districtId}::uuid,
        direction_degrees = ${input.directionDegrees ?? null},
        fov_degrees = ${input.fovDegrees ?? null}
      WHERE id = ${cameraId}::uuid
    `;
    return toDistrictCamera(cameraId, input);
  }

  /**
   * `Camera` is referenced by CameraExtractionRequest.cameraId and TrafficAccidentAlert.cameraId
   * (both required FKs, default onDelete behavior = restrict) — deleting a camera that already
   * has either would otherwise bubble up as a raw Postgres FK-violation 500. Checking first
   * turns that into a clear 409 instead.
   */
  async function deleteCamera(cameraId: string): Promise<void> {
    const existing = await deps.prisma.camera.findUnique({ where: { id: cameraId } });
    if (!existing) throw new HttpError(404, "CAMERA_NOT_FOUND", "Không tìm thấy camera.");

    const [extractionCount, alertCount] = await Promise.all([
      deps.prisma.cameraExtractionRequest.count({ where: { cameraId } }),
      deps.prisma.trafficAccidentAlert.count({ where: { cameraId } }),
    ]);
    if (extractionCount > 0 || alertCount > 0) {
      throw new HttpError(
        409,
        "CAMERA_IN_USE",
        "Không thể xoá camera đã có yêu cầu trích xuất hoặc cảnh báo tai nạn liên quan.",
      );
    }

    await deps.prisma.camera.delete({ where: { id: cameraId } });
  }

  /**
   * One call, N cameras, N independent request rows — sharing `groupId` only for display
   * purposes ("yêu cầu trích xuất theo tuyến đường, N camera") so the officer can see they
   * were requested together. Every row still just asks that camera's own managing unit to
   * pull footage for the same time window; nothing here compares footage across cameras or
   * tries to follow a person/vehicle from one to the next.
   */
  async function createExtractionRequest(
    subject: DistrictScopeSubject,
    reportId: string,
    input: CreateExtractionRequestInput,
  ) {
    await assertReportAccess(subject, reportId);

    if (input.timeRangeEnd <= input.timeRangeStart) {
      throw new HttpError(400, "INVALID_TIME_RANGE", "Thời điểm kết thúc phải sau thời điểm bắt đầu.");
    }

    const cameras = await Promise.all(
      input.cameraIds.map((cameraId) => deps.prisma.camera.findUnique({ where: { id: cameraId } })),
    );
    const missingIndex = cameras.findIndex((camera) => !camera);
    if (missingIndex !== -1) throw new HttpError(404, "CAMERA_NOT_FOUND", "Không tìm thấy camera.");

    const groupId = input.cameraIds.length > 1 ? randomUUID() : null;

    const created = await Promise.all(
      input.cameraIds.map((cameraId) =>
        deps.prisma.cameraExtractionRequest.create({
          data: {
            reportId,
            cameraId,
            requestedBy: subject.id,
            timeRangeStart: input.timeRangeStart,
            timeRangeEnd: input.timeRangeEnd,
            note: input.note,
            groupId,
          },
        }),
      ),
    );

    return { groupId, requests: created };
  }

  async function listExtractionRequests(subject: DistrictScopeSubject, reportId: string) {
    await assertReportAccess(subject, reportId);

    return deps.prisma.cameraExtractionRequest.findMany({
      where: { reportId },
      orderBy: { createdAt: "desc" },
      include: { camera: { select: { id: true, name: true } } },
    });
  }

  return {
    nearbyCameras,
    listDistrictCameras,
    createCamera,
    updateCamera,
    deleteCamera,
    createExtractionRequest,
    listExtractionRequests,
  };
}

export type CameraExtractionService = ReturnType<typeof createCameraExtractionService>;
