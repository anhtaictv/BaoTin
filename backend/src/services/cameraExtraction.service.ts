import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";

const DEFAULT_RADIUS_METERS = 500;

export interface NearbyCamera {
  id: string;
  name: string;
  managingUnitName: string | null;
  managingUnitContact: string | null;
  distanceMeters: number;
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

    return deps.prisma.$queryRaw<NearbyCamera[]>`
      SELECT
        c.id AS "id",
        c.name AS "name",
        c.managing_unit_name AS "managingUnitName",
        c.managing_unit_contact AS "managingUnitContact",
        ST_Distance(c.location::geography, r.location::geography) AS "distanceMeters"
      FROM cameras c, reports r
      WHERE r.id = ${reportId}
        AND ST_DWithin(c.location::geography, r.location::geography, ${radiusMeters})
      ORDER BY "distanceMeters" ASC
    `;
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

  return { nearbyCameras, createExtractionRequest, listExtractionRequests };
}

export type CameraExtractionService = ReturnType<typeof createCameraExtractionService>;
