import type { PrismaClient } from "@prisma/client";

/**
 * Stub for ARCHITECTURE.md's "liên kết ngược sang phần mềm tin bài chính" — no real
 * external case-management API exists to call yet (out of scope for Giai đoạn 1). Records
 * an official_case_links row with a null externalCaseId so the schema/workflow is exercised
 * end-to-end; swap the body of pushToOfficialCase for a real HTTP call later without
 * touching call sites (reportLifecycle/officerReports don't know this is a stub).
 */
export function createOfficialCaseLinkService(prisma: PrismaClient) {
  async function pushToOfficialCase(reportId: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[official-case-link-stub] would push report ${reportId} to the external case system`);
    await prisma.officialCaseLink.create({ data: { reportId, externalCaseId: null } });
  }

  return { pushToOfficialCase };
}

export type OfficialCaseLinkService = ReturnType<typeof createOfficialCaseLinkService>;
