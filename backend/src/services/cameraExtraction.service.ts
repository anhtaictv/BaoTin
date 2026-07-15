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
  cameraId: string;
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
      WHERE r.id = ${reportId}::uuid
        AND ST_DWithin(c.location::geography, r.location::geography, ${radiusMeters})
      ORDER BY "distanceMeters" ASC
    `;
  }

  async function createExtractionRequest(
    subject: DistrictScopeSubject,
    reportId: string,
    input: CreateExtractionRequestInput,
  ) {
    await assertReportAccess(subject, reportId);

    const camera = await deps.prisma.camera.findUnique({ where: { id: input.cameraId } });
    if (!camera) throw new HttpError(404, "CAMERA_NOT_FOUND", "Không tìm thấy camera.");

    if (input.timeRangeEnd <= input.timeRangeStart) {
      throw new HttpError(400, "INVALID_TIME_RANGE", "Thời điểm kết thúc phải sau thời điểm bắt đầu.");
    }

    return deps.prisma.cameraExtractionRequest.create({
      data: {
        reportId,
        cameraId: input.cameraId,
        requestedBy: subject.id,
        timeRangeStart: input.timeRangeStart,
        timeRangeEnd: input.timeRangeEnd,
        note: input.note,
      },
    });
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
