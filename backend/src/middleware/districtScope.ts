import type { PrismaClient } from "@prisma/client";
import { HttpError } from "./errorHandler.js";

export interface DistrictScopeSubject {
  id: string;
  role: string;
}

/**
 * SECURITY.md §1.4: "Officer chỉ truy vấn được tin thuộc district_id được phân công —
 * kiểm tra ở tầng backend, không chỉ ẩn ở UI." Always re-derives the officer's allowed
 * districts fresh from officer_district_assignments — never trusts a districtId carried
 * in the JWT, which could be stale if assignments change after the token was issued.
 * senior_officer/admin bypass the restriction entirely (explicit "trừ vai trò cấp trên").
 */
export function createDistrictScopeService(prisma: PrismaClient) {
  const UNRESTRICTED_ROLES = new Set(["senior_officer", "admin"]);

  async function getAllowedDistrictIds(officerId: string): Promise<string[]> {
    const assignments = await prisma.officerDistrictAssignment.findMany({
      where: { officerId, isActive: true },
      select: { districtId: true },
    });
    return assignments.map((a) => a.districtId);
  }

  /** Throws 403 if `subject` may not access `districtId`. No-op for unrestricted roles. */
  async function assertDistrictAccess(subject: DistrictScopeSubject, districtId: string | null): Promise<void> {
    if (UNRESTRICTED_ROLES.has(subject.role)) return;
    if (!districtId) {
      throw new HttpError(403, "FORBIDDEN", "Tin chưa được gán địa bàn, không thể truy cập.");
    }
    const allowed = await getAllowedDistrictIds(subject.id);
    if (!allowed.includes(districtId)) {
      throw new HttpError(403, "FORBIDDEN", "Không có quyền truy cập tin thuộc địa bàn này.");
    }
  }

  return { getAllowedDistrictIds, assertDistrictAccess };
}

export type DistrictScopeService = ReturnType<typeof createDistrictScopeService>;
