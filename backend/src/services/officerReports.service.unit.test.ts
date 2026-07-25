import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOfficerReportsService } from "./officerReports.service.js";
import { createDistrictScopeService } from "../middleware/districtScope.js";
import { encryptField } from "../crypto/aesGcm.js";
import { createFakeOfficerPrisma, type FakeOfficerPrisma } from "../test-utils/fakeOfficerPrisma.js";

const PII_ENCRYPTION_KEY = randomBytes(32).toString("base64");

function buildService(fakePrisma: FakeOfficerPrisma) {
  const officialCaseLinkCalls: string[] = [];
  const auditLogCalls: { officerId: string; action: string; target?: unknown; metadata?: unknown }[] = [];
  const notifyCalls: { userId: string; reportId: string; status: string }[] = [];
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const officialCaseLink = { pushToOfficialCase: async (reportId: string) => { officialCaseLinkCalls.push(reportId); } };
  const auditLog = {
    record: async (officerId: string, action: string, target?: unknown, metadata?: unknown) => {
      auditLogCalls.push({ officerId, action, target, metadata });
    },
  };
  const storage = { putObject: async () => {}, getPresignedGetUrl: async (key: string) => `https://minio.local/${key}` };
  const notifications = {
    notifyOfficerOfNewReport: async () => new Date(),
    notifyUserOfStatusChange: async (userId: string, reportId: string, status: string) => {
      notifyCalls.push({ userId, reportId, status });
      return new Date();
    },
    notifyOfficerOfAccidentAlert: async () => new Date(),
  };
  const service = createOfficerReportsService({
    prisma: fakePrisma as any,
    districtScope,
    officialCaseLink,
    auditLog,
    storage,
    notifications,
    piiEncryptionKey: PII_ENCRYPTION_KEY,
  });
  return { service, officialCaseLinkCalls, auditLogCalls, notifyCalls };
}

describe("officerReports.service — listReports", () => {
  it("a regular officer only sees reports in their assigned district", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const myDistrict = randomUUID();
    const otherDistrict = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: myDistrict, isActive: true });
    fakePrisma.seedReport({
      id: "mine", category: "a", urgency: "normal", status: "pending", source: "citizen",
      districtId: myDistrict, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });
    fakePrisma.seedReport({
      id: "not-mine", category: "a", urgency: "normal", status: "pending", source: "citizen",
      districtId: otherDistrict, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service } = buildService(fakePrisma);
    const { reports } = await service.listReports({ id: officerId, role: "officer" }, {});
    expect(reports.map((r) => r.id)).toEqual(["mine"]);
  });

  it("rejects an explicit district_id filter outside the officer's assignments", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: randomUUID(), isActive: true });
    const { service } = buildService(fakePrisma);

    await expect(
      service.listReports({ id: officerId, role: "officer" }, { districtId: randomUUID() }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("sorts results by priority (emergency first)", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "normal", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(1000), verifiedAt: null, responseTimeSeconds: null,
    });
    fakePrisma.seedReport({
      id: "urgent", category: null, urgency: "emergency", status: "pending", source: "citizen",
      districtId, createdAt: new Date(2000), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service } = buildService(fakePrisma);
    const { reports } = await service.listReports({ id: officerId, role: "officer" }, {});
    expect(reports.map((r) => r.id)).toEqual(["urgent", "normal"]);
  });

  it("admin sees across districts without an assignment row", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    fakePrisma.seedReport({
      id: "any-district", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId: randomUUID(), createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });
    const { service } = buildService(fakePrisma);
    const { reports, total } = await service.listReports({ id: randomUUID(), role: "admin" }, {});
    expect(reports).toHaveLength(1);
    expect(total).toBe(1);
  });

  it("paginates with a default page size, reporting total and hasMore", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    for (let i = 0; i < 5; i++) {
      fakePrisma.seedReport({
        id: `r${i}`, category: null, urgency: "normal", status: "pending", source: "citizen",
        districtId, createdAt: new Date(1000 * i), verifiedAt: null, responseTimeSeconds: null,
      });
    }

    const { service } = buildService(fakePrisma);
    const page1 = await service.listReports({ id: officerId, role: "officer" }, { pageSize: 2 });
    expect(page1.reports.map((r) => r.id)).toEqual(["r0", "r1"]);
    expect(page1).toMatchObject({ page: 1, pageSize: 2, total: 5, hasMore: true });

    const page3 = await service.listReports({ id: officerId, role: "officer" }, { page: 3, pageSize: 2 });
    expect(page3.reports.map((r) => r.id)).toEqual(["r4"]);
    expect(page3).toMatchObject({ page: 3, pageSize: 2, total: 5, hasMore: false });
  });

  it("clamps an out-of-range page_size to the max instead of erroring", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service } = buildService(fakePrisma);
    const { pageSize } = await service.listReports({ id: officerId, role: "officer" }, { pageSize: 500 });
    expect(pageSize).toBe(100);
  });

  it("includes each report's lat/lng so the officer app's map tab can plot pins", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "with-coords", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
      lat: 10.77, lng: 106.7,
    });

    const { service } = buildService(fakePrisma);
    const { reports } = await service.listReports({ id: officerId, role: "officer" }, {});
    expect(reports[0]!.location).toEqual({ lat: 10.77, lng: 106.7 });
  });
});

describe("officerReports.service — getOwnOverview", () => {
  it("aggregates counts server-side instead of requiring the caller to fetch every report", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "p1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(1000), verifiedAt: null, responseTimeSeconds: null,
    });
    fakePrisma.seedReport({
      id: "p2", category: null, urgency: "emergency", status: "pending", source: "citizen",
      districtId, createdAt: new Date(2000), verifiedAt: null, responseTimeSeconds: null,
    });
    fakePrisma.seedReport({
      id: "v1", category: null, urgency: "normal", status: "verifying", source: "citizen",
      districtId, createdAt: new Date(3000), verifiedAt: null, responseTimeSeconds: null,
    });
    fakePrisma.seedReport({
      id: "done", category: null, urgency: "normal", status: "confirmed_true", source: "citizen",
      districtId, createdAt: new Date(4000), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service } = buildService(fakePrisma);
    const stats = await service.getOwnOverview({ id: officerId, role: "officer" });

    expect(stats.total).toBe(4);
    expect(stats.byStatus).toEqual({ pending: 2, verifying: 1, confirmed_true: 1 });
    expect(stats.emergencyCount).toBe(1);
    // pending/verifying only, emergency first — same priority order as listReports.
    expect(stats.needsAttention.map((r) => r.id)).toEqual(["p2", "p1", "v1"]);
  });

  it("caps needsAttention at 5 rows regardless of how many are pending/verifying", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    for (let i = 0; i < 8; i++) {
      fakePrisma.seedReport({
        id: `r${i}`, category: null, urgency: "normal", status: "pending", source: "citizen",
        districtId, createdAt: new Date(1000 * i), verifiedAt: null, responseTimeSeconds: null,
      });
    }

    const { service } = buildService(fakePrisma);
    const stats = await service.getOwnOverview({ id: officerId, role: "officer" });
    expect(stats.total).toBe(8);
    expect(stats.needsAttention).toHaveLength(5);
  });
});

describe("officerReports.service — getReportDetail", () => {
  it("resolves each attachment's stored object key to a presigned URL", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    } as any);
    (fakePrisma.store.reports.get("r1") as any).attachments = [
      { id: "a1", fileUrl: "r1/photo-1.jpg", fileType: "image/jpeg" },
    ];

    const { service } = buildService(fakePrisma);
    const detail = await service.getReportDetail({ id: officerId, role: "officer" }, "r1");
    expect((detail as any).attachments[0].fileUrl).toBe("https://minio.local/r1/photo-1.jpg");
  });

  it("re-attaches lat/lng (PostGIS Unsupported field Prisma would otherwise silently drop)", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
      lat: 12.6789, lng: 108.0512,
    } as any);

    const { service } = buildService(fakePrisma);
    const detail = await service.getReportDetail({ id: officerId, role: "officer" }, "r1");
    expect((detail as any).location).toEqual({ lat: 12.6789, lng: 108.0512 });
  });

  it("404s for a non-existent report", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const { service } = buildService(fakePrisma);
    await expect(service.getReportDetail({ id: randomUUID(), role: "officer" }, randomUUID())).rejects.toMatchObject({
      status: 404,
    });
  });

  it("403s when the report belongs to a district outside the officer's assignment", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: randomUUID(), isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId: randomUUID(), createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });
    const { service } = buildService(fakePrisma);
    await expect(service.getReportDetail({ id: officerId, role: "officer" }, "r1")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("hides the reporter's identity from a regular officer when the report is anonymity-flagged", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
      user: {
        id: "user-1",
        isAnonymousPublic: true,
        phoneNumberEnc: encryptField("0912345678", PII_ENCRYPTION_KEY),
        fullNameEnc: encryptField("Nguyễn Văn A", PII_ENCRYPTION_KEY),
      },
    });

    const { service, auditLogCalls } = buildService(fakePrisma);
    const detail = await service.getReportDetail({ id: officerId, role: "officer" }, "r1");

    expect(detail.user).toEqual({ id: "user-1", anonymous: true });
    expect((detail.user as any).phoneNumber).toBeUndefined();
    // A regular officer viewing hidden identity is not a sensitive-identity-view event —
    // nothing was actually disclosed, so no audit entry.
    expect(auditLogCalls).toEqual([]);
  });

  it("shows full, decrypted identity to senior_officer/admin and logs it as a sensitive-identity view", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const seniorOfficerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
      user: {
        id: "user-1",
        isAnonymousPublic: true,
        phoneNumberEnc: encryptField("0912345678", PII_ENCRYPTION_KEY),
        fullNameEnc: encryptField("Nguyễn Văn A", PII_ENCRYPTION_KEY),
      },
    });

    const { service, auditLogCalls } = buildService(fakePrisma);
    const detail = await service.getReportDetail({ id: seniorOfficerId, role: "senior_officer" }, "r1");

    // Must be the real decrypted value, not the ciphertext — a senior officer who's allowed
    // to see identity data needs to actually be able to read it.
    expect((detail.user as any).phoneNumber).toBe("0912345678");
    expect((detail.user as any).fullName).toBe("Nguyễn Văn A");
    expect(auditLogCalls).toContainEqual(expect.objectContaining({ officerId: seniorOfficerId, action: "view_identity" }));
  });

  it("does not hide identity for a report that was never flagged anonymous, and still decrypts it", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
      user: {
        id: "user-1",
        isAnonymousPublic: false,
        phoneNumberEnc: encryptField("0912345678", PII_ENCRYPTION_KEY),
        fullNameEnc: encryptField("Nguyễn Văn A", PII_ENCRYPTION_KEY),
      },
    });

    const { service, auditLogCalls } = buildService(fakePrisma);
    const detail = await service.getReportDetail({ id: officerId, role: "officer" }, "r1");

    expect((detail.user as any).phoneNumber).toBe("0912345678");
    expect(auditLogCalls).toEqual([]);
  });
});

describe("officerReports.service — updateStatus", () => {
  it("records status history and computes response_time_seconds", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    const createdAt = new Date(Date.now() - 60_000); // 60s ago
    fakePrisma.seedReport({
      id: "r1", category: "khac", urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt, verifiedAt: null, responseTimeSeconds: null,
    });

    const { service } = buildService(fakePrisma);
    const result = await service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "verifying" });

    expect(result.status).toBe("verifying");
    expect(result.responseTimeSeconds).toBeGreaterThanOrEqual(59);
    expect(fakePrisma.store.statusHistory).toHaveLength(1);
    expect(fakePrisma.store.statusHistory[0]).toMatchObject({ reportId: "r1", oldStatus: "pending", newStatus: "verifying", changedBy: officerId });
  });

  it("pushes to the official case link on confirmed_true for a serious report (emergency)", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "emergency", status: "verifying", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service, officialCaseLinkCalls } = buildService(fakePrisma);
    await service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "confirmed_true" });
    expect(officialCaseLinkCalls).toEqual(["r1"]);
  });

  it("does NOT push to the official case link on confirmed_true for a non-serious normal report", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: "khac", urgency: "normal", status: "verifying", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service, officialCaseLinkCalls } = buildService(fakePrisma);
    await service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "confirmed_true" });
    expect(officialCaseLinkCalls).toEqual([]);
  });

  it("does NOT push to the official case link for confirmed_false regardless of severity", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "emergency", status: "verifying", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service, officialCaseLinkCalls } = buildService(fakePrisma);
    await service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "confirmed_false" });
    expect(officialCaseLinkCalls).toEqual([]);
  });

  it("403s when trying to update a report outside the officer's district", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: randomUUID(), isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId: randomUUID(), createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service } = buildService(fakePrisma);
    await expect(
      service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "verifying" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("persists the officer's note onto the status history row", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: "khac", urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const { service } = buildService(fakePrisma);
    await service.updateStatus({ id: officerId, role: "officer" }, "r1", {
      status: "verifying",
      note: "Đã liên hệ người báo tin, đang xác minh tại hiện trường.",
    });

    expect(fakePrisma.store.statusHistory[0]).toMatchObject({
      reportId: "r1",
      note: "Đã liên hệ người báo tin, đang xác minh tại hiện trường.",
    });
  });

  it("notifies the reporting citizen when their report's status changes", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const userId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: "khac", urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
      userId,
    });

    const { service, notifyCalls } = buildService(fakePrisma);
    await service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "confirmed_true" });

    expect(notifyCalls).toEqual([{ userId, reportId: "r1", status: "confirmed_true" }]);
  });

  it("does not notify when the report has no associated user (e.g. anonymous SOS)", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
      userId: null,
    });

    const { service, notifyCalls } = buildService(fakePrisma);
    await service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "verifying" });

    expect(notifyCalls).toEqual([]);
  });

  it("locks the user on their 4th confirmed_false report, not the 3rd", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const userId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedUser({ id: userId });
    for (let i = 0; i < 3; i++) {
      fakePrisma.seedReport({
        id: `old${i}`, category: null, urgency: "normal", status: "confirmed_false", source: "citizen",
        districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null, userId,
      });
    }
    fakePrisma.seedReport({
      id: "r4", category: null, urgency: "normal", status: "verifying", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null, userId,
    });

    const { service, auditLogCalls } = buildService(fakePrisma);
    // 3rd false report so far → not locked yet.
    await service.updateStatus({ id: officerId, role: "officer" }, "old2", { status: "confirmed_false" });
    expect(fakePrisma.store.users.get(userId)?.lockedAt).toBeNull();

    // 4th (this one) → locked, and audit-logged.
    await service.updateStatus({ id: officerId, role: "officer" }, "r4", { status: "confirmed_false" });
    expect(fakePrisma.store.users.get(userId)?.lockedAt).toBeInstanceOf(Date);
    expect(auditLogCalls).toContainEqual(
      expect.objectContaining({ officerId, action: "auto_lock_user", target: { type: "user", id: userId } }),
    );
  });

  it("does not lock on confirmed_true, only confirmed_false", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const userId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedUser({ id: userId });
    for (let i = 0; i < 4; i++) {
      fakePrisma.seedReport({
        id: `old${i}`, category: null, urgency: "normal", status: "confirmed_false", source: "citizen",
        districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null, userId,
      });
    }
    fakePrisma.seedReport({
      id: "r5", category: "khac", urgency: "normal", status: "verifying", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null, userId,
    });

    const { service } = buildService(fakePrisma);
    await service.updateStatus({ id: officerId, role: "officer" }, "r5", { status: "confirmed_true" });
    expect(fakePrisma.store.users.get(userId)?.lockedAt).toBeNull();
  });

  it("does not crash or lock when the report has no associated user", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: "r1", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null, userId: null,
    });

    const { service } = buildService(fakePrisma);
    await expect(
      service.updateStatus({ id: officerId, role: "officer" }, "r1", { status: "confirmed_false" }),
    ).resolves.toMatchObject({ status: "confirmed_false" });
  });
});
