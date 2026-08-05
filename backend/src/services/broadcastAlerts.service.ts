import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";
import type { NotificationService } from "../notifications/notification.service.js";

export interface BroadcastAlertsDeps {
  prisma: PrismaClient;
  districtScope: DistrictScopeService;
  notifications: NotificationService;
}

/** Same lookback used by areaAlerts.service.ts to decide who's "active" in a district — a
 * user counts as reachable for a broadcast if they reported here recently, not forever. */
const RECIPIENT_LOOKBACK_DAYS = 30;
/** Chunked + parallel-within-chunk (Promise.allSettled) instead of one big sequential loop —
 * a district with a large recipient list shouldn't block the Node event loop or blow past
 * FCM/APNS burst limits sending pushes one at a time. */
const PUSH_CHUNK_SIZE = 100;

export interface CreateBroadcastAlertInput {
  subject: DistrictScopeSubject;
  districtId: string;
  message: string;
  urgency: "emergency" | "normal";
}

export interface BroadcastAlertSummary {
  id: string;
  districtId: string;
  message: string;
  urgency: string;
  createdAt: Date;
}

export interface DistrictOption {
  id: string;
  tenXa: string;
}

/**
 * Geo-fence alert (theo địa bàn/phường, không phải bán kính GPS liên tục — CLAUDE.md-adjacent
 * scope decision made explicit in the plan) — a regular officer can only broadcast to a
 * district they're actually assigned to (assertDistrictAccess, same guard officer report
 * access already uses); senior_officer/admin are unrestricted.
 */
export function createBroadcastAlertsService(deps: BroadcastAlertsDeps) {
  async function create(input: CreateBroadcastAlertInput): Promise<BroadcastAlertSummary> {
    await deps.districtScope.assertDistrictAccess(input.subject, input.districtId);

    const district = await deps.prisma.district.findUnique({
      where: { id: input.districtId },
      select: { id: true, tenXa: true },
    });
    if (!district) throw new HttpError(404, "DISTRICT_NOT_FOUND", "Không tìm thấy địa bàn.");

    const alert = await deps.prisma.officerBroadcastAlert.create({
      data: {
        districtId: input.districtId,
        message: input.message,
        urgency: input.urgency,
        createdById: input.subject.id,
      },
    });

    await notifyDistrictRecipients(input.districtId, district.tenXa, input.message);

    return {
      id: alert.id,
      districtId: alert.districtId,
      message: alert.message,
      urgency: alert.urgency,
      createdAt: alert.createdAt,
    };
  }

  /** Best-effort push, alongside the pull-based `recentBroadcasts` in GET /area-alerts
   * (areaAlerts.service.ts) — a failed/slow push here never blocks the alert from having been
   * created, since notifications.notifyUserOfDistrictBroadcast already swallows send failures
   * per-recipient (see FirebaseNotificationSender.ts). */
  async function notifyDistrictRecipients(districtId: string, districtName: string, message: string): Promise<void> {
    const since = new Date(Date.now() - RECIPIENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const rows = await deps.prisma.report.findMany({
      where: { source: "citizen", districtId, createdAt: { gte: since }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    });
    const userIds = rows.map((r) => r.userId).filter((id): id is string => id != null);

    for (let i = 0; i < userIds.length; i += PUSH_CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + PUSH_CHUNK_SIZE);
      await Promise.allSettled(
        chunk.map((userId) => deps.notifications.notifyUserOfDistrictBroadcast(userId, message, districtName)),
      );
    }
  }

  /** Powers the officer app's district picker when composing an alert — a regular officer
   * only ever sees their own active assignments (mirrors resolveDistrictFilter's pattern in
   * officerReports.service.ts), senior_officer/admin see every district. */
  async function listAvailableDistricts(subject: DistrictScopeSubject): Promise<DistrictOption[]> {
    const isUnrestricted = subject.role === "senior_officer" || subject.role === "admin";
    if (isUnrestricted) {
      return deps.prisma.district.findMany({ select: { id: true, tenXa: true }, orderBy: { tenXa: "asc" } });
    }
    const allowedIds = await deps.districtScope.getAllowedDistrictIds(subject.id);
    if (allowedIds.length === 0) return [];
    return deps.prisma.district.findMany({
      where: { id: { in: allowedIds } },
      select: { id: true, tenXa: true },
      orderBy: { tenXa: "asc" },
    });
  }

  return { create, listAvailableDistricts };
}

export type BroadcastAlertsService = ReturnType<typeof createBroadcastAlertsService>;
