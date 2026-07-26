import { describe, it, expect } from "vitest";
import { createTrafficAccidentAlertsService } from "./trafficAccidentAlerts.service.js";
import { createDistrictScopeService } from "../middleware/districtScope.js";
import { createAssignOfficerService } from "../geo/assignOfficer.service.js";
import { createFakeTrafficAccidentPrisma } from "../test-utils/fakeTrafficAccidentPrisma.js";

function buildService() {
  const fakePrisma = createFakeTrafficAccidentPrisma();
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const assignOfficer = createAssignOfficerService(fakePrisma as any);
  const notifyCalls: { officerId: string; alertId: string }[] = [];
  const storedObjects: { key: string; mimetype: string }[] = [];
  const storage = {
    putObject: async (key: string, _buffer: Buffer, mimetype: string) => {
      storedObjects.push({ key, mimetype });
    },
    getPresignedGetUrl: async (key: string) => `https://minio.local/${key}`,
  };
  const notifications = {
    notifyOfficerOfNewReport: async () => new Date(),
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async (officerId: string, alertId: string) => {
      notifyCalls.push({ officerId, alertId });
      return new Date();
    },
    notifyOfficerOfChatMessage: async () => new Date(),
  };

  const service = createTrafficAccidentAlertsService({
    prisma: fakePrisma as any,
    districtScope,
    assignOfficer,
    storage,
    notifications,
  });

  return { service, fakePrisma, notifyCalls, storedObjects };
}

describe("trafficAccidentAlerts.service", () => {
  it("ingestDetection resolves district+officer from the camera and notifies the assigned officer", async () => {
    const { service, fakePrisma, notifyCalls, storedObjects } = buildService();
    fakePrisma.seedCamera({ id: "cam-1", districtId: "district-1" });
    fakePrisma.seedAssignment({ officerId: "officer-1", districtId: "district-1", isActive: true });

    const result = await service.ingestDetection({
      cameraId: "cam-1",
      plateNumbers: ["51H-123.45"],
      thumbnail: { buffer: Buffer.from("fake-jpeg"), mimetype: "image/jpeg" },
    });

    expect(result.status).toBe("pending");
    const alert = fakePrisma.store.alerts.get(result.id)!;
    expect(alert.districtId).toBe("district-1");
    expect(alert.assignedOfficerId).toBe("officer-1");
    expect(alert.plateNumbers).toBe("51H-123.45");
    expect(storedObjects).toHaveLength(1);
    expect(notifyCalls).toEqual([{ officerId: "officer-1", alertId: result.id }]);
  });

  it("ingestDetection throws 404 for an unknown camera", async () => {
    const { service } = buildService();
    await expect(service.ingestDetection({ cameraId: "missing", plateNumbers: [] })).rejects.toMatchObject({
      status: 404,
      code: "CAMERA_NOT_FOUND",
    });
  });

  it("listAlerts restricts a regular officer to their assigned districts", async () => {
    const { service, fakePrisma } = buildService();
    fakePrisma.seedCamera({ id: "cam-1", districtId: "district-1" });
    fakePrisma.seedCamera({ id: "cam-2", districtId: "district-2" });
    fakePrisma.seedAssignment({ officerId: "officer-1", districtId: "district-1", isActive: true });
    const inScope = await service.ingestDetection({ cameraId: "cam-1", plateNumbers: [] });
    await service.ingestDetection({ cameraId: "cam-2", plateNumbers: [] });

    const alerts = await service.listAlerts({ id: "officer-1", role: "officer" }, {});
    expect(alerts.map((a) => a.id)).toEqual([inScope.id]);
  });

  it("senior_officer sees alerts across every district", async () => {
    const { service, fakePrisma } = buildService();
    fakePrisma.seedCamera({ id: "cam-1", districtId: "district-1" });
    fakePrisma.seedCamera({ id: "cam-2", districtId: "district-2" });
    await service.ingestDetection({ cameraId: "cam-1", plateNumbers: [] });
    await service.ingestDetection({ cameraId: "cam-2", plateNumbers: [] });

    const alerts = await service.listAlerts({ id: "senior-1", role: "senior_officer" }, {});
    expect(alerts).toHaveLength(2);
  });

  it("confirmAlert sets status/confirmedByOfficerId and rejects an officer outside the district", async () => {
    const { service, fakePrisma } = buildService();
    fakePrisma.seedCamera({ id: "cam-1", districtId: "district-1" });
    fakePrisma.seedAssignment({ officerId: "officer-1", districtId: "district-1", isActive: true });
    const created = await service.ingestDetection({ cameraId: "cam-1", plateNumbers: [] });

    const result = await service.confirmAlert({ id: "officer-1", role: "officer" }, created.id);
    expect(result.status).toBe("confirmed");
    expect(fakePrisma.store.alerts.get(created.id)!.confirmedByOfficerId).toBe("officer-1");

    await expect(service.dismissAlert({ id: "officer-2", role: "officer" }, created.id)).rejects.toMatchObject({
      status: 403,
    });
  });
});
