import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createReportLifecycleService } from "./reportLifecycle.service.js";
import { createFakeReportPrisma, type FakeReportPrisma } from "../test-utils/fakeReportPrisma.js";
import type { GeoMatchService } from "../geo/geoMatch.service.js";
import type { AssignOfficerService } from "../geo/assignOfficer.service.js";
import type { StorageClient } from "../storage/minioClient.js";
import type { NotificationService } from "../notifications/notification.service.js";

const IN_BOUNDS_DISTRICT_ID = randomUUID();
const ASSIGNED_OFFICER_ID = randomUUID();
const USER_ID = randomUUID();

function buildService(
  fakePrisma: FakeReportPrisma,
  opts: { districtId: string | null; officerId: string | null } = {
    districtId: IN_BOUNDS_DISTRICT_ID,
    officerId: ASSIGNED_OFFICER_ID,
  },
) {
  const putObjectCalls: { key: string; mimetype: string }[] = [];
  const notifyCalls: { officerId: string; reportId: string; urgent: boolean }[] = [];

  const geoMatch: GeoMatchService = {
    matchDistrict: async () => opts.districtId,
    matchNearestDistrict: async () => opts.districtId,
  };
  const assignOfficer: AssignOfficerService = {
    pickOfficerForDistrict: async () => opts.officerId,
  };
  const storage: StorageClient = {
    putObject: async (key, _buf, mimetype) => {
      putObjectCalls.push({ key, mimetype });
    },
    getPresignedGetUrl: async (key) => `https://minio.local/${key}`,
  };
  const notifications: NotificationService = {
    notifyOfficerOfNewReport: async (officerId, reportId, urgent) => {
      notifyCalls.push({ officerId, reportId, urgent });
      return new Date();
    },
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async () => new Date(),
  };

  const service = createReportLifecycleService({
    prisma: fakePrisma as any,
    geoMatch,
    assignOfficer,
    storage,
    notifications,
  });

  return { service, putObjectCalls, notifyCalls };
}

describe("reportLifecycle.service — createCitizenReport", () => {
  let fakePrisma: FakeReportPrisma;

  beforeEach(() => {
    fakePrisma = createFakeReportPrisma();
  });

  it("creates a pending report matched to the resolved district and officer", async () => {
    const { service } = buildService(fakePrisma);

    const { reportId, status } = await service.createCitizenReport({
      userId: USER_ID,
      category: "trom_cap",
      description: "Mất xe máy",
      location: { lat: 12.66, lng: 108.05, source: "exif" },
      attachments: [],
    });

    expect(status).toBe("pending");
    const stored = fakePrisma.store.reports.find((r) => r.id === reportId);
    expect(stored?.districtId).toBe(IN_BOUNDS_DISTRICT_ID);
    expect(stored?.assignedOfficerId).toBe(ASSIGNED_OFFICER_ID);
    expect(stored?.urgency).toBe("normal");
  });

  it("uploads each attachment to storage and records EXIF GPS per attachment", async () => {
    const { service, putObjectCalls } = buildService(fakePrisma);

    const { reportId } = await service.createCitizenReport({
      userId: USER_ID,
      category: "tai_nan",
      location: { lat: 12.66, lng: 108.05, source: "device_gps" },
      attachments: [
        { buffer: Buffer.from("fake-jpeg-1"), mimetype: "image/jpeg", exifGps: { lat: 12.661, lng: 108.051 } },
        { buffer: Buffer.from("fake-jpeg-2"), mimetype: "image/jpeg", exifGps: null },
      ],
    });

    expect(putObjectCalls).toHaveLength(2);
    const stored = fakePrisma.store.attachments.filter((a) => a.reportId === reportId);
    expect(stored).toHaveLength(2);
    expect(stored[0].exifGpsLat).toBe(12.661);
    expect(stored[1].exifGpsLat).toBeNull();
  });

  it("notifies the assigned officer with urgent=false for a normal report", async () => {
    const { service, notifyCalls } = buildService(fakePrisma);
    await service.createCitizenReport({
      userId: USER_ID,
      category: "khac",
      location: { lat: 12.66, lng: 108.05, source: "manual_pin" },
      attachments: [],
    });
    expect(notifyCalls).toEqual([{ officerId: ASSIGNED_OFFICER_ID, reportId: expect.any(String), urgent: false }]);
  });

  it("does not notify anyone when geo-matching finds no district (out of bounds)", async () => {
    const { service, notifyCalls } = buildService(fakePrisma, { districtId: null, officerId: null });
    const { reportId } = await service.createCitizenReport({
      userId: USER_ID,
      category: "khac",
      location: { lat: 0, lng: 0, source: "manual_pin" },
      attachments: [],
    });
    expect(notifyCalls).toHaveLength(0);
    const stored = fakePrisma.store.reports.find((r) => r.id === reportId);
    expect(stored?.districtId).toBeNull();
    expect(stored?.assignedOfficerId).toBeNull();
  });

  it("403s a locked user trying to submit a normal report", async () => {
    fakePrisma.seedLockedUser(USER_ID);
    const { service } = buildService(fakePrisma);

    await expect(
      service.createCitizenReport({
        userId: USER_ID,
        category: "khac",
        location: { lat: 12.66, lng: 108.05, source: "manual_pin" },
        attachments: [],
      }),
    ).rejects.toMatchObject({ status: 403, code: "ACCOUNT_LOCKED" });
  });
});

describe("reportLifecycle.service — createEmergencyReport", () => {
  it("still lets a locked user submit an SOS report — locking never blocks the emergency path", async () => {
    const fakePrisma = createFakeReportPrisma();
    fakePrisma.seedLockedUser(USER_ID);
    const { service } = buildService(fakePrisma);

    const { status } = await service.createEmergencyReport({
      userId: USER_ID,
      emergencyType: "chay_no",
      location: { lat: 12.66, lng: 108.05 },
    });
    expect(status).toBe("pending");
  });

  it("creates an emergency-urgency report with no attachments and notifies urgently", async () => {
    const fakePrisma = createFakeReportPrisma();
    const { service, notifyCalls } = buildService(fakePrisma);

    const { status } = await service.createEmergencyReport({
      userId: USER_ID,
      emergencyType: "chay_no",
      location: { lat: 12.66, lng: 108.05 },
    });

    expect(status).toBe("pending");
    expect(fakePrisma.store.reports[0]?.urgency).toBe("emergency");
    expect(notifyCalls).toEqual([{ officerId: ASSIGNED_OFFICER_ID, reportId: expect.any(String), urgent: true }]);
  });

  it("also pushes to every admin account (not just the district's assigned officer)", async () => {
    const fakePrisma = createFakeReportPrisma();
    const admin1 = randomUUID();
    const admin2 = randomUUID();
    fakePrisma.seedOfficer({ id: admin1, role: "admin" });
    fakePrisma.seedOfficer({ id: admin2, role: "admin" });
    fakePrisma.seedOfficer({ id: randomUUID(), role: "officer" }); // not an admin — must not be notified
    const { service, notifyCalls } = buildService(fakePrisma);

    await service.createEmergencyReport({
      userId: USER_ID,
      emergencyType: "chay_no",
      location: { lat: 12.66, lng: 108.05 },
    });

    expect(notifyCalls).toHaveLength(3);
    expect(notifyCalls.map((c) => c.officerId).sort()).toEqual([ASSIGNED_OFFICER_ID, admin1, admin2].sort());
    expect(notifyCalls.every((c) => c.urgent)).toBe(true);
  });

  it("still notifies admins even when no district/officer could be matched", async () => {
    const fakePrisma = createFakeReportPrisma();
    const admin1 = randomUUID();
    fakePrisma.seedOfficer({ id: admin1, role: "admin" });
    const { service, notifyCalls } = buildService(fakePrisma, { districtId: null, officerId: null });

    await service.createEmergencyReport({
      userId: USER_ID,
      emergencyType: "chay_no",
      location: { lat: 0, lng: 0 },
    });

    expect(notifyCalls).toEqual([{ officerId: admin1, reportId: expect.any(String), urgent: true }]);
  });

  it("does not double-notify when the assigned officer is themselves an admin", async () => {
    const fakePrisma = createFakeReportPrisma();
    fakePrisma.seedOfficer({ id: ASSIGNED_OFFICER_ID, role: "admin" });
    const { service, notifyCalls } = buildService(fakePrisma);

    await service.createEmergencyReport({
      userId: USER_ID,
      emergencyType: "chay_no",
      location: { lat: 12.66, lng: 108.05 },
    });

    expect(notifyCalls).toEqual([{ officerId: ASSIGNED_OFFICER_ID, reportId: expect.any(String), urgent: true }]);
  });
});

describe("reportLifecycle.service — listMyReports / getReportStatus", () => {
  it("lists only the caller's own reports, most recent first", async () => {
    const fakePrisma = createFakeReportPrisma();
    const { service } = buildService(fakePrisma);
    const otherUserId = randomUUID();

    await service.createCitizenReport({
      userId: USER_ID,
      category: "a",
      location: { lat: 12.66, lng: 108.05, source: "device_gps" },
      attachments: [],
    });
    await service.createCitizenReport({
      userId: otherUserId,
      category: "b",
      location: { lat: 12.66, lng: 108.05, source: "device_gps" },
      attachments: [],
    });

    const mine = await service.listMyReports(USER_ID);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.category).toBe("a");
  });

  it("404s when the report doesn't belong to the requesting user", async () => {
    const fakePrisma = createFakeReportPrisma();
    const { service } = buildService(fakePrisma);
    const { reportId } = await service.createCitizenReport({
      userId: USER_ID,
      category: "a",
      location: { lat: 12.66, lng: 108.05, source: "device_gps" },
      attachments: [],
    });

    await expect(service.getReportStatus(reportId, randomUUID())).rejects.toThrow(/REPORT_NOT_FOUND|không tìm thấy/i);
  });

  it("returns status for the owning user", async () => {
    const fakePrisma = createFakeReportPrisma();
    const { service } = buildService(fakePrisma);
    const { reportId } = await service.createCitizenReport({
      userId: USER_ID,
      category: "a",
      location: { lat: 12.66, lng: 108.05, source: "device_gps" },
      attachments: [],
    });

    const status = await service.getReportStatus(reportId, USER_ID);
    expect(status.status).toBe("pending");
  });

  it("returns latestNote as null when the report has no status history yet", async () => {
    const fakePrisma = createFakeReportPrisma();
    const { service } = buildService(fakePrisma);
    const { reportId } = await service.createCitizenReport({
      userId: USER_ID,
      category: "a",
      location: { lat: 12.66, lng: 108.05, source: "device_gps" },
      attachments: [],
    });

    const status = await service.getReportStatus(reportId, USER_ID);
    expect(status.latestNote).toBeNull();
  });

  it("returns the most recent status history note as latestNote", async () => {
    const fakePrisma = createFakeReportPrisma();
    const { service } = buildService(fakePrisma);
    const { reportId } = await service.createCitizenReport({
      userId: USER_ID,
      category: "a",
      location: { lat: 12.66, lng: 108.05, source: "device_gps" },
      attachments: [],
    });

    fakePrisma.store.statusHistory.push({
      id: randomUUID(),
      reportId,
      oldStatus: "pending",
      newStatus: "verifying",
      changedBy: randomUUID(),
      note: "Đang xác minh tại hiện trường.",
      changedAt: new Date(Date.now() - 60_000),
    });
    fakePrisma.store.statusHistory.push({
      id: randomUUID(),
      reportId,
      oldStatus: "verifying",
      newStatus: "confirmed_true",
      changedBy: randomUUID(),
      note: "Đã xác nhận đúng sự thật.",
      changedAt: new Date(),
    });

    const status = await service.getReportStatus(reportId, USER_ID);
    expect(status.latestNote).toBe("Đã xác nhận đúng sự thật.");
  });
});
