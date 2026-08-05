import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBroadcastAlertsService } from "./broadcastAlerts.service.js";
import { createDistrictScopeService } from "../middleware/districtScope.js";
import type { NotificationService } from "../notifications/notification.service.js";

/** Small fake covering exactly what broadcastAlerts.service.ts + the real
 * districtScope.assertDistrictAccess (used unmocked here) touch. */
function createFakeBroadcastPrisma() {
  const districts = new Map<string, string>();
  const assignments: { officerId: string; districtId: string; isActive: boolean }[] = [];
  const alerts: { id: string; districtId: string; message: string; urgency: string; createdById: string; createdAt: Date }[] = [];
  const reports: { userId: string | null; districtId: string; source: string; createdAt: Date }[] = [];

  return {
    store: { alerts },
    seedDistrict(id: string, tenXa = "Test District") {
      districts.set(id, tenXa);
    },
    seedAssignment(officerId: string, districtId: string) {
      assignments.push({ officerId, districtId, isActive: true });
    },
    seedReporter(userId: string, districtId: string, createdAt: Date = new Date()) {
      reports.push({ userId, districtId, source: "citizen", createdAt });
    },
    district: {
      async findUnique({ where }: { where: { id: string } }) {
        return districts.has(where.id) ? { id: where.id, tenXa: districts.get(where.id) } : null;
      },
      async findMany({ where }: { where?: { id: { in: string[] } } } = {}) {
        const rows = [...districts.entries()]
          .filter(([id]) => !where || where.id.in.includes(id))
          .map(([id, tenXa]) => ({ id, tenXa }));
        return rows.sort((a, b) => a.tenXa.localeCompare(b.tenXa));
      },
    },
    officerDistrictAssignment: {
      async findMany({ where }: { where: { officerId: string; isActive: boolean } }) {
        return assignments
          .filter((a) => a.officerId === where.officerId && a.isActive === where.isActive)
          .map((a) => ({ districtId: a.districtId }));
      },
    },
    officerBroadcastAlert: {
      async create({ data }: { data: { districtId: string; message: string; urgency: string; createdById: string } }) {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        alerts.push(row);
        return row;
      },
    },
    report: {
      async findMany({ where }: { where: { districtId: string; createdAt: { gte: Date } } }) {
        const seen = new Set<string>();
        return reports
          .filter((r) => r.districtId === where.districtId && r.createdAt >= where.createdAt.gte && r.userId != null)
          .filter((r) => (seen.has(r.userId as string) ? false : (seen.add(r.userId as string), true)))
          .map((r) => ({ userId: r.userId }));
      },
    },
  };
}

function createFakeNotifications() {
  const calls: { userId: string; message: string; districtName: string }[] = [];
  const notifications: NotificationService = {
    notifyOfficerOfNewReport: async () => new Date(),
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async () => new Date(),
    notifyOfficerOfChatMessage: async () => new Date(),
    notifyUserOfDistrictBroadcast: async (userId, message, districtName) => {
      calls.push({ userId, message, districtName });
      return new Date();
    },
  };
  return { notifications, calls };
}

describe("broadcastAlerts.service — create", () => {
  it("creates an alert when the officer is assigned to the target district", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const districtId = randomUUID();
    const officerId = randomUUID();
    fakePrisma.seedDistrict(districtId);
    fakePrisma.seedAssignment(officerId, districtId);
    const { notifications } = createFakeNotifications();
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    const result = await service.create({
      subject: { id: officerId, role: "officer" },
      districtId,
      message: "Cướp giật gần chợ, người dân lưu ý.",
      urgency: "emergency",
    });

    expect(result.districtId).toBe(districtId);
    expect(result.urgency).toBe("emergency");
    expect(fakePrisma.store.alerts).toHaveLength(1);
    expect(fakePrisma.store.alerts[0]?.createdById).toBe(officerId);
  });

  it("403s a regular officer broadcasting to a district they are not assigned to", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const districtId = randomUUID();
    const officerId = randomUUID();
    fakePrisma.seedDistrict(districtId);
    // No assignment seeded for this officer/district pair.
    const { notifications } = createFakeNotifications();
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    await expect(
      service.create({
        subject: { id: officerId, role: "officer" },
        districtId,
        message: "Test",
        urgency: "normal",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(fakePrisma.store.alerts).toHaveLength(0);
  });

  it("lets senior_officer/admin broadcast to any district without an assignment", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const districtId = randomUUID();
    fakePrisma.seedDistrict(districtId);
    const { notifications } = createFakeNotifications();
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    const result = await service.create({
      subject: { id: randomUUID(), role: "admin" },
      districtId,
      message: "Thiên tai — sơ tán khu vực trũng thấp.",
      urgency: "emergency",
    });

    expect(result.districtId).toBe(districtId);
  });

  it("404s when the district does not exist", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const officerId = randomUUID();
    const { notifications } = createFakeNotifications();
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    await expect(
      service.create({
        subject: { id: officerId, role: "admin" },
        districtId: randomUUID(),
        message: "Test",
        urgency: "normal",
      }),
    ).rejects.toMatchObject({ status: 404, code: "DISTRICT_NOT_FOUND" });
  });

  it("pushes to every distinct recent reporter in the district, deduped, with the resolved district name", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const districtId = randomUUID();
    const otherDistrictId = randomUUID();
    const officerId = randomUUID();
    const user1 = randomUUID();
    const user2 = randomUUID();
    fakePrisma.seedDistrict(districtId, "Phường Tân Định");
    fakePrisma.seedAssignment(officerId, districtId);
    fakePrisma.seedReporter(user1, districtId);
    fakePrisma.seedReporter(user1, districtId); // same user reported twice — must dedupe
    fakePrisma.seedReporter(user2, districtId);
    fakePrisma.seedReporter(randomUUID(), otherDistrictId); // different district — must not be pushed
    const { notifications, calls } = createFakeNotifications();
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    await service.create({
      subject: { id: officerId, role: "officer" },
      districtId,
      message: "Cháy lớn, tránh xa khu vực.",
      urgency: "emergency",
    });

    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.userId).sort()).toEqual([user1, user2].sort());
    expect(calls.every((c) => c.districtName === "Phường Tân Định")).toBe(true);
  });

  it("does not fail alert creation when a push notification fails", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const districtId = randomUUID();
    const officerId = randomUUID();
    fakePrisma.seedDistrict(districtId);
    fakePrisma.seedAssignment(officerId, districtId);
    fakePrisma.seedReporter(randomUUID(), districtId);
    const notifications: NotificationService = {
      notifyOfficerOfNewReport: async () => new Date(),
      notifyUserOfStatusChange: async () => new Date(),
      notifyOfficerOfAccidentAlert: async () => new Date(),
      notifyOfficerOfChatMessage: async () => new Date(),
      notifyUserOfDistrictBroadcast: async () => {
        throw new Error("FCM unreachable");
      },
    };
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    const result = await service.create({
      subject: { id: officerId, role: "officer" },
      districtId,
      message: "Test",
      urgency: "normal",
    });

    expect(result.districtId).toBe(districtId);
    expect(fakePrisma.store.alerts).toHaveLength(1);
  });
});

describe("broadcastAlerts.service — listAvailableDistricts", () => {
  it("returns only the officer's own active assignments", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const officerId = randomUUID();
    const mine = randomUUID();
    const notMine = randomUUID();
    fakePrisma.seedDistrict(mine, "Phường A");
    fakePrisma.seedDistrict(notMine, "Phường B");
    fakePrisma.seedAssignment(officerId, mine);
    const { notifications } = createFakeNotifications();
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    const districts = await service.listAvailableDistricts({ id: officerId, role: "officer" });

    expect(districts).toEqual([{ id: mine, tenXa: "Phường A" }]);
  });

  it("returns every district for senior_officer/admin regardless of assignments", async () => {
    const fakePrisma = createFakeBroadcastPrisma();
    const d1 = randomUUID();
    const d2 = randomUUID();
    fakePrisma.seedDistrict(d1, "Phường A");
    fakePrisma.seedDistrict(d2, "Phường B");
    const { notifications } = createFakeNotifications();
    const service = createBroadcastAlertsService({
      prisma: fakePrisma as any,
      districtScope: createDistrictScopeService(fakePrisma as any),
      notifications,
    });

    const districts = await service.listAvailableDistricts({ id: randomUUID(), role: "admin" });

    expect(districts).toHaveLength(2);
  });
});
