import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
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
  /** Client-generated idempotency key (offline queue retries) — see createCitizenReport. */
  clientRequestId?: string;
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
  async function insertReportRow(
    client: PrismaClient | Prisma.TransactionClient,
    params: {
      reportId: string;
      userId: string;
      category: string;
      urgency: "normal" | "emergency";
      description: string | null;
      lat: number;
      lng: number;
      locationSource: string | null;
      districtId: string | null;
      assignedOfficerId: string | null;
      clientRequestId: string | null;
    },
  ): Promise<void> {
    await client.$executeRaw`
      INSERT INTO reports (
        id, source, user_id, category, urgency, description,
        location, location_source, district_id, assigned_officer_id, status, client_request_id
      )
      VALUES (
        ${params.reportId}::uuid, 'citizen', ${params.userId}::uuid, ${params.category}, ${params.urgency}::report_urgency,
        ${params.description}, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326),
        ${params.locationSource}, ${params.districtId}::uuid, ${params.assignedOfficerId}::uuid, 'pending'::report_status,
        ${params.clientRequestId}
      )
    `;
  }

  async function createCitizenReport(input: CreateCitizenReportInput) {
    // Blocks normal reports only — createEmergencyReport below never checks this, SOS must
    // stay reachable regardless (CLAUDE.md: stability for the emergency path over feature
    // richness). Locked by officerReports.service.ts's updateStatus after a citizen's 4th
    // confirmed_false report; lifted only by deliberate admin action, no auto-expiry.
    const user = await deps.prisma.user.findUnique({ where: { id: input.userId }, select: { lockedAt: true } });
    if (user?.lockedAt) {
      throw new HttpError(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa do có nhiều tin báo bị xác nhận là sai.");
    }

    // Fast path for a retried submission (offline queue flush, or a request that succeeded
    // but the response never reached the client): skip geo-match/uploads/notify entirely and
    // hand back the already-created report instead of filing a duplicate.
    if (input.clientRequestId) {
      const existing = await deps.prisma.report.findFirst({
        where: { userId: input.userId, clientRequestId: input.clientRequestId },
        select: { id: true, status: true },
      });
      if (existing) return { reportId: existing.id, status: existing.status };
    }

    const districtId = await deps.geoMatch.matchDistrict({ lat: input.location.lat, lng: input.location.lng });
    const assignedOfficerId = districtId ? await deps.assignOfficer.pickOfficerForDistrict(districtId) : null;
    const reportId = randomUUID();

    // MinIO uploads happen before the DB transaction (object storage has no 2PC with Postgres,
    // and network I/O inside an interactive Prisma transaction risks hitting its timeout). If a
    // later DB write fails, the transaction rolls back cleanly and we're left with orphaned
    // MinIO objects (a cleanup cost) rather than a report row referencing an attachment DB row
    // that never got created (a broken read for the citizen checking their report).
    const uploadedAttachments = await Promise.all(
      input.attachments.map(async (attachment) => {
        const key = `${reportId}/${randomUUID()}`;
        await deps.storage.putObject(key, attachment.buffer, attachment.mimetype);
        return { key, attachment };
      }),
    );

    try {
      await deps.prisma.$transaction(async (tx) => {
        await insertReportRow(tx, {
          reportId,
          userId: input.userId,
          category: input.category,
          urgency: "normal",
          description: input.description ?? null,
          lat: input.location.lat,
          lng: input.location.lng,
          locationSource: input.location.source,
          districtId,
          assignedOfficerId,
          clientRequestId: input.clientRequestId ?? null,
        });

        for (const { key, attachment } of uploadedAttachments) {
          await tx.reportAttachment.create({
            data: {
              reportId,
              fileUrl: key,
              fileType: attachment.mimetype,
              exifGpsLat: attachment.exifGps?.lat ?? null,
              exifGpsLng: attachment.exifGps?.lng ?? null,
            },
          });
        }
      });
    } catch (err) {
      // Two overlapping submissions with the same clientRequestId (retry fired before the
      // first one committed) — the unique index is the real guard, this findFirst-after-catch
      // just resolves the race in favor of "return the one that won" instead of a 500. The
      // uploaded MinIO objects for the losing attempt become orphaned (accepted cost, same
      // tradeoff as any transaction rollback here — see comment on uploadedAttachments above).
      if (input.clientRequestId && err instanceof Prisma.PrismaClientKnownRequestError) {
        const existing = await deps.prisma.report.findFirst({
          where: { userId: input.userId, clientRequestId: input.clientRequestId },
          select: { id: true, status: true },
        });
        if (existing) return { reportId: existing.id, status: existing.status };
      }
      throw err;
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
    const reportId = randomUUID();

    await insertReportRow(deps.prisma, {
      reportId,
      userId: input.userId,
      category: input.emergencyType,
      urgency: "emergency",
      description: null,
      lat: input.location.lat,
      lng: input.location.lng,
      locationSource: "device_gps",
      districtId,
      assignedOfficerId,
      clientRequestId: null,
    });

    // Admin also gets pushed for emergency reports specifically (SOS, any district) —
    // deliberately NOT done for createCitizenReport's normal-urgency path above, which would
    // flood admin with every report from all 102 xã/phường instead of just the district
    // officer who's actually responsible for it (product decision, not an oversight).
    const admins = await deps.prisma.officer.findMany({ where: { role: "admin" }, select: { id: true } });
    await Promise.all([
      assignedOfficerId ? deps.notifications.notifyOfficerOfNewReport(assignedOfficerId, reportId, true) : null,
      ...admins
        .filter((a) => a.id !== assignedOfficerId)
        .map((a) => deps.notifications.notifyOfficerOfNewReport(a.id, reportId, true)),
    ]);

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
      select: {
        id: true,
        status: true,
        urgency: true,
        category: true,
        createdAt: true,
        verifiedAt: true,
        responseTimeSeconds: true,
        assignedOfficerId: true,
      },
    });
    if (!report) throw new HttpError(404, "REPORT_NOT_FOUND", "Không tìm thấy tin báo.");

    // The officer's note at the most recent status change — the other half of the same
    // notification the citizen already got when the status changed (see
    // notifyUserOfStatusChange in officerReports.service.ts's updateStatus).
    const latestHistory = await deps.prisma.reportStatusHistory.findFirst({
      where: { reportId },
      orderBy: { changedAt: "desc" },
      select: { note: true },
    });

    return { ...report, latestNote: latestHistory?.note ?? null };
  }

  return { createCitizenReport, createEmergencyReport, listMyReports, getReportStatus };
}

export type ReportLifecycleService = ReturnType<typeof createReportLifecycleService>;
