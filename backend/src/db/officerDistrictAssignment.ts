import type { PrismaClient } from "@prisma/client";

/**
 * Ensures `officerId` has an active district-level (oldDistrictId null) assignment to
 * `districtId`. Not a plain `upsert` — Prisma's compound-unique WhereUniqueInput requires
 * every field to be non-null (SQL NULL never equals NULL), so
 * `officerId_districtId_oldDistrictId: { ..., oldDistrictId: null }` doesn't typecheck. Used
 * by every place that assigns an officer to a whole new District rather than an old-ward
 * sub-area: accountRegistration.service.ts's approveOfficer, seed-officers.ts,
 * scripts/promote-officer-role.ts.
 */
export async function upsertWholeDistrictAssignment(
  prisma: PrismaClient,
  officerId: string,
  districtId: string,
): Promise<void> {
  const existing = await prisma.officerDistrictAssignment.findFirst({
    where: { officerId, districtId, oldDistrictId: null },
  });
  if (existing) {
    await prisma.officerDistrictAssignment.update({ where: { id: existing.id }, data: { isActive: true } });
  } else {
    await prisma.officerDistrictAssignment.create({ data: { officerId, districtId, isActive: true } });
  }
}
