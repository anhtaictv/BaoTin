import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import { decryptField } from "../crypto/aesGcm.js";
import type { AuditLogService } from "./auditLog.service.js";

export interface CommuneAssignmentDeps {
  prisma: PrismaClient;
  piiEncryptionKey: string;
  auditLog: AuditLogService;
}

export interface CommuneHeadDistrict {
  districtId: string;
  tenXa: string;
}

export interface OldWardOption {
  oldDistrictId: string;
  tenXa: string;
  tenHuyen: string | null;
  tenTinh: string | null;
  overlapRatio: number;
}

export interface SubordinateSummary {
  officerId: string;
  fullName: string;
  oldDistrictId: string | null;
  oldWardLabel: string | null;
}

/**
 * Trưởng xã (commune_head) subdividing their own District (xã/phường MỚI, sau sáp nhập)
 * into old-ward (xã/phường CŨ, trước sáp nhập) sub-areas for cấp dưới accounts — CLAUDE.md
 * "phân quyền... theo địa bàn cũ để chính xác hơn". admin bypasses every ownership check
 * below; every other role is read-only (enforced by route-level requireAuth, not here).
 */
export function createCommuneAssignmentService(deps: CommuneAssignmentDeps) {
  /** The single new-District a commune_head is head of — their own active, district-level
   * (oldDistrictId null) assignment row. Mirrors assignOfficer.service.ts's "first active
   * assignment found" pattern for the (expected-singular) case of more than one such row. */
  async function getCommuneHeadDistrict(officerId: string): Promise<CommuneHeadDistrict | null> {
    const assignment = await deps.prisma.officerDistrictAssignment.findFirst({
      // officer.role filter matters: a plain "officer" also has an active, oldDistrictId-null
      // assignment row by default (that's the un-sub-assigned state, not "heads this
      // district") — without this filter, GET /officer/commune/my-district (any officer role
      // can call it) would tell a random cấp dưới they're the trưởng xã of their own district.
      where: { officerId, oldDistrictId: null, isActive: true, officer: { role: "commune_head" } },
      include: { district: { select: { id: true, tenXa: true } } },
      orderBy: { id: "asc" },
    });
    if (!assignment) return null;
    return { districtId: assignment.district.id, tenXa: assignment.district.tenXa };
  }

  /** Throws 403 unless `actor` may manage assignments in `districtId` — admin (any district)
   * or the commune_head heading exactly that district. Returns nothing; callers proceed. */
  async function assertCanManageDistrict(actor: { id: string; role: string }, districtId: string): Promise<void> {
    if (actor.role === "admin") return;
    if (actor.role !== "commune_head") {
      throw new HttpError(403, "FORBIDDEN", "Chỉ trưởng xã hoặc quản lý mới được phân địa bàn phụ trách.");
    }
    const own = await getCommuneHeadDistrict(actor.id);
    if (!own || own.districtId !== districtId) {
      throw new HttpError(403, "FORBIDDEN", "Trưởng xã chỉ được phân địa bàn trong xã/phường mình phụ trách.");
    }
  }

  /** Old wards (xã/phường cũ) overlapping `districtId`, most-overlapping first — the picker
   * list for assigning a cấp dưới's sub-area. Visible to any authenticated officer (read-only). */
  async function listOldWardsForDistrict(districtId: string): Promise<OldWardOption[]> {
    const rows = await deps.prisma.oldDistrictOverlap.findMany({
      where: { districtId },
      include: { oldDistrict: { select: { id: true, tenXa: true, tenHuyen: true, tenTinh: true } } },
      orderBy: { overlapRatio: "desc" },
    });
    return rows.map((r) => ({
      oldDistrictId: r.oldDistrict.id,
      tenXa: r.oldDistrict.tenXa,
      tenHuyen: r.oldDistrict.tenHuyen,
      tenTinh: r.oldDistrict.tenTinh,
      overlapRatio: r.overlapRatio,
    }));
  }

  /** Cấp dưới ("officer" role) currently assigned to `districtId`, with their current
   * old-ward sub-area if any. Excludes commune_head/senior_officer/admin rows — those aren't
   * "cấp dưới" for this district. Read-only, visible to any authenticated officer. */
  async function listSubordinates(districtId: string): Promise<SubordinateSummary[]> {
    const rows = await deps.prisma.officerDistrictAssignment.findMany({
      where: { districtId, isActive: true, officer: { role: "officer" } },
      include: {
        officer: { select: { id: true, fullNameEnc: true } },
        oldDistrict: { select: { tenXa: true, tenHuyen: true } },
      },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => ({
      officerId: r.officer.id,
      fullName: decryptField(r.officer.fullNameEnc, deps.piiEncryptionKey),
      oldDistrictId: r.oldDistrictId,
      oldWardLabel: r.oldDistrict ? `${r.oldDistrict.tenXa} (${r.oldDistrict.tenHuyen ?? "?"} cũ)` : null,
    }));
  }

  /** Assigns (or clears, oldDistrictId=null) the old-ward sub-area a cấp dưới is responsible
   * for within `districtId`. Requires the target already be actively assigned to that
   * district (assigning them there in the first place stays an admin-only action via the
   * existing officer-approval flow — see accountRegistration.service.ts's approveOfficer). */
  async function assignSubordinateOldDistrict(
    actor: { id: string; role: string },
    districtId: string,
    targetOfficerId: string,
    oldDistrictId: string | null,
  ): Promise<void> {
    await assertCanManageDistrict(actor, districtId);

    const target = await deps.prisma.officerDistrictAssignment.findFirst({
      where: { officerId: targetOfficerId, districtId, isActive: true, officer: { role: "officer" } },
    });
    if (!target) {
      throw new HttpError(404, "ASSIGNMENT_NOT_FOUND", "Tài khoản cấp dưới chưa được gán vào địa bàn này.");
    }

    if (oldDistrictId !== null) {
      const overlap = await deps.prisma.oldDistrictOverlap.findUnique({
        where: { oldDistrictId_districtId: { oldDistrictId, districtId } },
      });
      if (!overlap) {
        throw new HttpError(400, "OLD_DISTRICT_NOT_IN_DISTRICT", "Xã/phường cũ này không thuộc địa bàn xã/phường mới đang chọn.");
      }
    }

    await deps.prisma.officerDistrictAssignment.update({
      where: { id: target.id },
      data: { oldDistrictId },
    });
    await deps.auditLog.record(actor.id, "assign_old_district_area", { type: "officer", id: targetOfficerId }, { districtId, oldDistrictId });
  }

  return {
    getCommuneHeadDistrict,
    assertCanManageDistrict,
    listOldWardsForDistrict,
    listSubordinates,
    assignSubordinateOldDistrict,
  };
}

export type CommuneAssignmentService = ReturnType<typeof createCommuneAssignmentService>;
