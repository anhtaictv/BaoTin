import { describe, expect, it, vi } from "vitest";
import { seedLockedCitizen } from "./seed-locked-citizen.js";

function fakeDeps(overrides?: { existingUser?: { id: string; lockedAt: Date | null } | null }) {
  const reportId = "report-1";
  const prisma: any = {
    user: {
      findUnique: vi.fn().mockResolvedValue(overrides?.existingUser ?? null),
      create: vi.fn().mockResolvedValue({ id: "user-1", lockedAt: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    officer: { findFirst: vi.fn().mockResolvedValue({ id: "officer-1", role: "admin" }) },
    report: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: reportId, status: "pending" }),
      update: vi.fn().mockResolvedValue({}),
    },
    reportStatusHistory: { create: vi.fn().mockResolvedValue({}) },
  };
  const reportLifecycle: any = {
    createCitizenReport: vi.fn().mockResolvedValue({ reportId }),
  };
  return {
    prisma,
    reportLifecycle,
    piiEncryptionKey: "c1jmFv0keu4TjTH+sRb2XyPeePLD4px9xmU9GWHszVo=",
    phoneBlindIndexKey: "c1jmFv0keu4TjTH+sRb2XyPeePLD4px9xmU9GWHszVo=",
  };
}

describe("seedLockedCitizen", () => {
  it("creates 4 confirmed_false reports then locks the demo citizen", async () => {
    const deps = fakeDeps();
    await seedLockedCitizen(deps);

    expect(deps.reportLifecycle.createCitizenReport).toHaveBeenCalledTimes(4);
    expect(deps.prisma.report.update).toHaveBeenCalledTimes(4);
    for (const call of deps.prisma.report.update.mock.calls) {
      expect(call[0].data.status).toBe("confirmed_false");
    }
    expect(deps.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lockedAt: expect.any(Date) }) }),
    );
  });

  it("skips entirely when the demo citizen is already locked", async () => {
    const deps = fakeDeps({ existingUser: { id: "user-1", lockedAt: new Date() } });
    await seedLockedCitizen(deps);

    expect(deps.reportLifecycle.createCitizenReport).not.toHaveBeenCalled();
    expect(deps.prisma.user.update).not.toHaveBeenCalled();
  });
});
