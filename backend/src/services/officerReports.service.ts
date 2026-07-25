import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";
import type { OfficialCaseLinkService } from "./officialCaseLink.service.js";
import type { AuditLogService } from "./auditLog.service.js";
import type { StorageClient } from "../storage/minioClient.js";
import type { NotificationService } from "../notifications/notification.service.js";
import { decryptField } from "../crypto/aesGcm.js";
import { isSeriousReport } from "./priority.service.js";
import { isSensitiveIdentityView, serializeReportForViewer } from "./reportAnonymity.js";

export interface ListReportsFilters {
  districtId?: string;
  status?: string;
  urgency?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface UpdateStatusInput {
  status: "verifying" | "confirmed_true" | "confirmed_false";
  note?: string;
}

export interface OfficerReportsDeps {
  prisma: PrismaClient;
  districtScope: DistrictScopeService;
  officialCaseLink: OfficialCaseLinkService;
  auditLog: AuditLogService;
  storage: StorageClient;
  notifications: NotificationService;
  piiEncryptionKey: string;
}

const REPORT_LIST_SELECT = {
  id: true,
  category: true,
  urgency: true,
  status: true,
  districtId: true,
  createdAt: true,
} as const;

export function createOfficerReportsService(deps: OfficerReportsDeps) {
  /**
   * Shared by listReports and getOwnOverview — regular officers are constrained server-side
   * to their *actual* current assignments (re-derived from officer_district_assignments, not
   * a JWT claim); an explicit district_id filter outside that set is rejected, not silently
   * dropped, so a crafted request can't fish for another ward's reports.
   */
  async function resolveDistrictFilter(subject: DistrictScopeSubject, districtId?: string) {
    const isUnrestricted = subject.role === "senior_officer" || subject.role === "admin";
    if (isUnrestricted) {
      return districtId ? [districtId] : undefined;
    }
    const allowed = await deps.districtScope.getAllowedDistrictIds(subject.id);
    if (districtId && !allowed.includes(districtId)) {
      throw new HttpError(403, "FORBIDDEN", "Không có quyền truy cập tin thuộc địa bàn này.");
    }
    return districtId ? [districtId] : allowed;
  }

  async function listReports(subject: DistrictScopeSubject, filters: ListReportsFilters) {
    const districtIdFilter = await resolveDistrictFilter(subject, filters.districtId);

    const where = {
      source: "citizen" as const,
      ...(districtIdFilter ? { districtId: { in: districtIdFilter } } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.urgency ? { urgency: filters.urgency as never } : {}),
    };
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

    const [reports, total] = await Promise.all([
      deps.prisma.report.findMany({
        where,
        select: REPORT_LIST_SELECT,
        // Priority order pushed into the DB (required for skip/take to slice the *right*
        // page) — the `report_urgency` enum was declared ('emergency', 'normal') in that
        // order (0_init migration), so `asc` puts emergency first, matching
        // priority.service.ts's computePriorityScore giving it the top score.
        // ponytail: doesn't replicate computePriorityScore's category-based +500 tiebreak
        // (chay_no/tai_nan/an_ninh_khan_cap ranked above other same-urgency reports) —
        // urgency ordering alone already guarantees no emergency report gets buried past
        // page 1, which is the safety-relevant property. Upgrade path if the category
        // tiebreak needs to hold across page boundaries too: a generated `priority_score`
        // column (indexable, orderBy-able) instead of computing it in JS.
        orderBy: [{ urgency: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      deps.prisma.report.count({ where }),
    ]);

    // Same PostGIS-omission workaround as getReportDetail below, batched: one extra query
    // for the whole page's coordinates (map tab needs them) instead of N+1 per report.
    const ids = reports.map((r) => r.id);
    const locations = ids.length
      ? await deps.prisma.$queryRaw<{ id: string; lat: number; lng: number }[]>`
          SELECT id, ST_Y(location) AS lat, ST_X(location) AS lng FROM reports WHERE id = ANY(${ids})
        `
      : [];
    const locationById = new Map(locations.map((l) => [l.id, { lat: l.lat, lng: l.lng }]));

    return {
      reports: reports.map((r) => ({ ...r, location: locationById.get(r.id) ?? null })),
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
    };
  }

  /**
   * Backs the officer app's "Tổng quan" tab KPI tiles. Deliberately a `groupBy` aggregate
   * (like dashboardStats.service.ts's getOverview) instead of listReports() with a big
   * page_size — that screen used to fetch every matching report and count client-side, which
   * silently undercounts once a district passes whatever page_size cap listReports uses.
   * "Cần chú ý" only needs a handful of rows, not a full-table read either.
   */
  async function getOwnOverview(subject: DistrictScopeSubject) {
    const districtIdFilter = await resolveDistrictFilter(subject, undefined);
    const where = {
      source: "citizen" as const,
      ...(districtIdFilter ? { districtId: { in: districtIdFilter } } : {}),
    };

    const [total, byStatusRaw, emergencyCount, needsAttention] = await Promise.all([
      deps.prisma.report.count({ where }),
      deps.prisma.report.groupBy({ by: ["status"], where, _count: true }),
      deps.prisma.report.count({ where: { ...where, urgency: "emergency" } }),
      deps.prisma.report.findMany({
        where: { ...where, status: { in: ["pending", "verifying"] } },
        select: REPORT_LIST_SELECT,
        orderBy: [{ urgency: "asc" }, { createdAt: "asc" }],
        take: 5,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatusRaw.map((r) => [r.status, r._count])),
      emergencyCount,
      needsAttention,
    };
  }

  async function getReportDetail(subject: DistrictScopeSubject, reportId: string) {
    const report = await deps.prisma.report.findUnique({
      where: { id: reportId },
      include: { attachments: true, user: true },
    });
    if (!report) throw new HttpError(404, "REPORT_NOT_FOUND", "Không tìm thấy tin báo.");
    await deps.districtScope.assertDistrictAccess(subject, report.districtId);

    if (isSensitiveIdentityView(report, subject.role)) {
      await deps.auditLog.record(subject.id, "view_identity", { type: "report", id: reportId });
    }

    // report_attachments.file_url stores only the MinIO object key (ARCHITECTURE.md: "chỉ
    // lưu path trong Postgres") — resolve it to a short-lived presigned URL here, at the
    // read boundary, so nothing is ever handed out as a permanently-public link.
    const attachmentsWithUrls = await Promise.all(
      report.attachments.map(async (attachment) => ({
        ...attachment,
        fileUrl: await deps.storage.getPresignedGetUrl(attachment.fileUrl),
      })),
    );

    // reports.location is a PostGIS Unsupported(...) field — Prisma silently omits it from
    // every query result (findUnique above included), so it must be re-read via raw SQL for
    // the officer detail view to show coordinates at all. ST_X/ST_Y match the lng/lat
    // convention used everywhere else in geoMatch.service.ts and reportLifecycle.service.ts.
    const [locationRow] = await deps.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y(location) AS lat, ST_X(location) AS lng FROM reports WHERE id = ${reportId}
    `;

    // Decrypt identity fields *before* the anonymity check — serializeReportForViewer only
    // decides whether to keep or strip `user`, it must never receive raw AES-GCM ciphertext
    // to pass through, or a viewer who's allowed to see identity would get an unreadable
    // blob instead of an actual phone number/name.
    const decryptedUser = report.user
      ? {
          id: report.user.id,
          isAnonymousPublic: report.user.isAnonymousPublic,
          phoneNumber: decryptField(report.user.phoneNumberEnc, deps.piiEncryptionKey),
          fullName: report.user.fullNameEnc
            ? decryptField(report.user.fullNameEnc, deps.piiEncryptionKey)
            : null,
        }
      : null;

    const { report: serialized } = serializeReportForViewer(
      {
        ...report,
        user: decryptedUser,
        attachments: attachmentsWithUrls,
        location: locationRow ? { lat: locationRow.lat, lng: locationRow.lng } : null,
      },
      subject.role,
    );
    return serialized;
  }

  async function updateStatus(subject: DistrictScopeSubject, reportId: string, input: UpdateStatusInput) {
    const report = await deps.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new HttpError(404, "REPORT_NOT_FOUND", "Không tìm thấy tin báo.");
    await deps.districtScope.assertDistrictAccess(subject, report.districtId);

    const verifiedAt = new Date();
    const responseTimeSeconds = Math.max(
      0,
      Math.floor((verifiedAt.getTime() - report.createdAt.getTime()) / 1000),
    );

    await deps.prisma.$transaction([
      deps.prisma.report.update({
        where: { id: reportId },
        data: { status: input.status, verifiedAt, responseTimeSeconds },
      }),
      deps.prisma.reportStatusHistory.create({
        data: {
          reportId,
          oldStatus: report.status,
          newStatus: input.status,
          changedBy: subject.id,
          note: input.note,
        },
      }),
    ]);

    // API_SPEC.md: only confirmed_true + serious severity pushes to the official case system.
    // Human-in-the-loop is still preserved — an officer chose confirmed_true, nothing here
    // draws that conclusion automatically (CLAUDE.md non-negotiable #3).
    if (input.status === "confirmed_true" && isSeriousReport({ urgency: report.urgency, category: report.category })) {
      await deps.officialCaseLink.pushToOfficialCase(reportId);
    }

    // The other direction of the same notification channel that already tells an officer
    // about a new report — a citizen previously had no way to learn of a status change
    // except opening the app and checking themselves.
    if (report.userId) {
      await deps.notifications.notifyUserOfStatusChange(report.userId, reportId, input.status);
    }

    return { reportId, status: input.status, responseTimeSeconds };
  }

  return { listReports, getOwnOverview, getReportDetail, updateStatus };
}

export type OfficerReportsService = ReturnType<typeof createOfficerReportsService>;
