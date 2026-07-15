import type { PrismaClient } from "@prisma/client";

/**
 * Picks an officer for a matched district. Giai đoạn 1 stub: first active assignment found —
 * deliberately not load-balanced (round-robin/least-busy is out of scope until real usage
 * data exists). Documented here so nobody mistakes this for the final assignment strategy.
 */
export function createAssignOfficerService(prisma: PrismaClient) {
  async function pickOfficerForDistrict(districtId: string): Promise<string | null> {
    const assignment = await prisma.officerDistrictAssignment.findFirst({
      where: { districtId, isActive: true },
      orderBy: { id: "asc" },
    });
    return assignment?.officerId ?? null;
  }

  return { pickOfficerForDistrict };
}

export type AssignOfficerService = ReturnType<typeof createAssignOfficerService>;
