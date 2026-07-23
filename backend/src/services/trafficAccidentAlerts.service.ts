import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";
import type { StorageClient } from "../storage/minioClient.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { AssignOfficerService } from "../geo/assignOfficer.service.js";

export interface IngestAccidentDetectionInput {
  cameraId: string;
  plateNumbers: string[];
  detectedAt?: Date;
  thumbnail?: { buffer: Buffer; mimetype: string };
}

export interface ListAccidentAlertsFilters {
  districtId?: string;
  status?: string;
}

export interface TrafficAccidentAlertsDeps {
  prisma: PrismaClient;
  districtScope: DistrictScopeService;
  assignOfficer: AssignOfficerService;
  storage: StorageClient;
  notifications: NotificationService;
}

const ALERT_LIST_SELECT = {
  id: true,
  cameraId: true,
  districtId: true,
  plateNumbers: true,
  status: true,
  detectedAt: true,
} as const;

/**
 * Object-detection-only traffic accident alerts (YOLO person/vehicle detection + collision/
 * deceleration heuristic + license-plate OCR, run by a paired Python worker — see
 * schema.prisma's TrafficAccidentAlert docstring). Deliberately excludes face embedding,
 * person re-id, or cross-camera tracking from the same Python codebase — that stays out of
 * Báo Tin entirely. Mirrors officerReports.service.ts's district-scoping shape; every alert
 * starts `pending` and needs an officer's explicit confirm/dismiss (CLAUDE.md #3
 * human-in-the-loop) — nothing here is ever auto-filed as a confirmed incident.
 */
export function createTrafficAccidentAlertsService(deps: TrafficAccidentAlertsDeps) {
  async function ingestDetection(input: IngestAccidentDetectionInput) {
    const camera = await deps.prisma.camera.findUnique({ where: { id: input.cameraId } });
    if (!camera) throw new HttpError(404, "CAMERA_NOT_FOUND", "Không tìm thấy camera.");

    const assignedOfficerId = camera.districtId
      ? await deps.assignOfficer.pickOfficerForDistrict(camera.districtId)
      : null;

    let thumbnailUrl: string | null = null;
    if (input.thumbnail) {
      thumbnailUrl = `traffic-accident-alerts/${randomUUID()}`;
      await deps.storage.putObject(thumbnailUrl, input.thumbnail.buffer, input.thumbnail.mimetype);
    }

    const alert = await deps.prisma.trafficAccidentAlert.create({
      data: {
        cameraId: input.cameraId,
        districtId: camera.districtId,
        assignedOfficerId,
        plateNumbers: input.plateNumbers.length ? input.plateNumbers.join(", ") : null,
        thumbnailUrl,
        detectedAt: input.detectedAt ?? new Date(),
      },
    });

    if (assignedOfficerId) {
      await deps.notifications.notifyOfficerOfAccidentAlert(assignedOfficerId, alert.id);
    }

    return { id: alert.id, status: alert.status };
  }

  async function listAlerts(subject: DistrictScopeSubject, filters: ListAccidentAlertsFilters) {
    const isUnrestricted = subject.role === "senior_officer" || subject.role === "admin";
    let districtIdFilter: string[] | undefined;

    if (isUnrestricted) {
      districtIdFilter = filters.districtId ? [filters.districtId] : undefined;
    } else {
      const allowed = await deps.districtScope.getAllowedDistrictIds(subject.id);
      if (filters.districtId && !allowed.includes(filters.districtId)) {
        throw new HttpError(403, "FORBIDDEN", "Không có quyền truy cập cảnh báo thuộc địa bàn này.");
      }
      districtIdFilter = filters.districtId ? [filters.districtId] : allowed;
    }

    return deps.prisma.trafficAccidentAlert.findMany({
      where: {
        ...(districtIdFilter ? { districtId: { in: districtIdFilter } } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      select: ALERT_LIST_SELECT,
      orderBy: { detectedAt: "desc" },
    });
  }

  async function getAlertDetail(subject: DistrictScopeSubject, alertId: string) {
    const alert = await deps.prisma.trafficAccidentAlert.findUnique({
      where: { id: alertId },
      include: { camera: true },
    });
    if (!alert) throw new HttpError(404, "ALERT_NOT_FOUND", "Không tìm thấy cảnh báo.");
    await deps.districtScope.assertDistrictAccess(subject, alert.districtId);

    const thumbnailUrl = alert.thumbnailUrl ? await deps.storage.getPresignedGetUrl(alert.thumbnailUrl) : null;
    return { ...alert, thumbnailUrl };
  }

  async function setAlertStatus(subject: DistrictScopeSubject, alertId: string, status: "confirmed" | "dismissed") {
    const alert = await deps.prisma.trafficAccidentAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new HttpError(404, "ALERT_NOT_FOUND", "Không tìm thấy cảnh báo.");
    await deps.districtScope.assertDistrictAccess(subject, alert.districtId);

    await deps.prisma.trafficAccidentAlert.update({
      where: { id: alertId },
      data: { status, confirmedAt: new Date(), confirmedByOfficerId: subject.id },
    });

    return { id: alertId, status };
  }

  async function confirmAlert(subject: DistrictScopeSubject, alertId: string) {
    return setAlertStatus(subject, alertId, "confirmed");
  }

  async function dismissAlert(subject: DistrictScopeSubject, alertId: string) {
    return setAlertStatus(subject, alertId, "dismissed");
  }

  return { ingestDetection, listAlerts, getAlertDetail, confirmAlert, dismissAlert };
}

export type TrafficAccidentAlertsService = ReturnType<typeof createTrafficAccidentAlertsService>;
