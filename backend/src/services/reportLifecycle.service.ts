import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { GeoMatchService } from "../geo/geoMatch.service.js";
import type { AssignOfficerService } from "../geo/assignOfficer.service.js";
import type { StorageClient } from "../storage/minioClient.js";
import type { NotificationService } from "../notifications/notification.service.js";

export interface ReportAttachmentInput {
  buffer: Buffer;
  mimetype: string;
  exifGps: { lat: number; lng: number } | null;
}

export interface CreateCitizenReportInput {
  userId: string;
  category: string;
  description?: string;
  location: { lat: number; lng: number; source: string };
  attachments: ReportAttachmentInput[];
}

export interface CreateEmergencyReportInput {
  userId: string;
  emergencyType: string;
  location: { lat: number; lng: number };
}

export interface ReportLifecycleDeps {
  prisma: PrismaClient;
  geoMatch: GeoMatchService;
  assignOfficer: AssignOfficerService;
  storage: StorageClient;
  notifications: NotificationService;
}

export function createReportLifecycleService(deps: ReportLifecycleDeps) {
  async function insertReportRow(params: {
    userId: string;
    category: string;
    urgency: "normal" | "emergency";
    description: string | null;
    lat: number;
    lng: number;
    locationSource: string | null;
    districtId: string | null;
    assignedOfficerId: string | null;
  }): Promise<string> {
    const reportId = randomUUID();
    await deps.prisma.$executeRaw`
      INSERT INTO reports (
        id, source, user_id, category, urgency, description,
        location, location_source, district_id, assigned_officer_id, status
      )
      VALUES (
        ${reportId}::uuid, 'citizen', ${params.userId}::uuid, ${params.category}, ${params.urgency}::report_urgency,
        ${params.description}, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326),
        ${params.locationSource}, ${params.districtId}::uuid, ${params.assignedOfficerId}::uuid, 'pending'::report_status
      )
    `;
    return reportId;
  }

  async function createCitizenReport(input: CreateCitizenReportInput) {
    const districtId = await deps.geoMatch.matchDistrict({ lat: input.location.lat, lng: input.location.lng });
    const assignedOfficerId = districtId ? await deps.assignOfficer.pickOfficerForDistrict(districtId) : null;

    const reportId = await insertReportRow({
      userId: input.userId,
      category: input.category,
      urgency: "normal",
      description: input.description ?? null,
      lat: input.location.lat,
      lng: input.location.lng,
      locationSource: input.location.source,
      districtId,
      assignedOfficerId,
    });

    for (const attachment of input.attachments) {
      const key = `${reportId}/${randomUUID()}`;
      await deps.storage.putObject(key, attachment.buffer, attachment.mimetype);
      await deps.prisma.reportAttachment.create({
        data: {
          reportId,
          fileUrl: key,
          fileType: attachment.mimetype,
          exifGpsLat: attachment.exifGps?.lat ?? null,
          exifGpsLng: attachment.exifGps?.lng ?? null,
        },
      });
    }

    if (assignedOfficerId) {
      await deps.notifications.notifyOfficerOfNewReport(assignedOfficerId, reportId, false);
    }

    return { reportId, status: "pending" as const };
  }

  /**
   * API_SPEC.md: emergency path must not be slowed down by non-essential work.
   * Skips attachment handling entirely (SOS button sends no photos) and matches/notifies
   * the same way but with urgency='emergency' so priority.service sorts it first.
   */
  async function createEmergencyReport(input: CreateEmergencyReportInput) {
    const districtId = await deps.geoMatch.matchDistrict(input.location);
    const assignedOfficerId = districtId ? await deps.assignOfficer.pickOfficerForDistrict(districtId) : null;

    const reportId = await insertReportRow({
      userId: input.userId,
      category: input.emergencyType,
      urgency: "emergency",
      description: null,
      lat: input.location.lat,
      lng: input.location.lng,
      locationSource: "device_gps",
      districtId,
      assignedOfficerId,
    });

    if (assignedOfficerId) {
      await deps.notifications.notifyOfficerOfNewReport(assignedOfficerId, reportId, true);
    }

    return { reportId, status: "pending" as const };
  }

  async function listMyReports(userId: string) {
    return deps.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, status: true, urgency: true, createdAt: true },
    });
  }

  async function getReportStatus(reportId: string, userId: string) {
    const report = await deps.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: { id: true, status: true, createdAt: true, verifiedAt: true, responseTimeSeconds: true },
    });
    if (!report) throw new HttpError(404, "REPORT_NOT_FOUND", "Không tìm thấy tin báo.");
    return report;
  }

  return { createCitizenReport, createEmergencyReport, listMyReports, getReportStatus };
}

export type ReportLifecycleService = ReturnType<typeof createReportLifecycleService>;
