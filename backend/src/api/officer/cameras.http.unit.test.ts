import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createCamerasController } from "./cameras.controller.js";
import { createCamerasRoutes } from "./cameras.routes.js";
import { createCameraExtractionService } from "../../services/cameraExtraction.service.js";
import { createDistrictScopeService } from "../../middleware/districtScope.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { createFakeCameraPrisma } from "../../test-utils/fakeCameraPrisma.js";

const BUON_MA_THUOT = { lat: 12.68, lng: 108.05 };

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeCameraPrisma();
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const service = createCameraExtractionService({ prisma: fakePrisma as any, districtScope });
  const controller = createCamerasController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const camerasRouter = createCamerasRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), camerasRouter });

  async function tokenFor(role: string, id = randomUUID()) {
    return signAccessToken({ sub: id, role }, privateKey, 20);
  }

  return { app, fakePrisma, tokenFor };
}

describe("GET /officer/reports/:id/nearby-cameras", () => {
  it("auto-returns nearby cameras for an officer's own district report", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera gần",
      lat: 12.6805,
      lng: 108.0505,
      managingUnitName: "Công an phường",
      managingUnitContact: "0900000001",
    });

    const res = await request(app)
      .get(`/officer/reports/${reportId}/nearby-cameras?radius_m=1000`)
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Camera gần");
  });

  it("403s for a report outside the officer's district", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: randomUUID(), isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId: randomUUID(), ...BUON_MA_THUOT });

    const res = await request(app)
      .get(`/officer/reports/${reportId}/nearby-cameras`)
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);
    expect(res.status).toBe(403);
  });

  it("400s on an out-of-range radius", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get(`/officer/reports/${randomUUID()}/nearby-cameras?radius_m=999999`)
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /officer/reports/:id/camera-extraction-requests", () => {
  it("creates a request and it shows up in the list endpoint", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    const cameraId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({
      id: cameraId,
      name: "Camera chợ",
      lat: 12.68,
      lng: 108.05,
      managingUnitName: "Ban quản lý chợ",
      managingUnitContact: "0900000005",
    });
    const token = await tokenFor("officer", officerId);

    const createRes = await request(app)
      .post(`/officer/reports/${reportId}/camera-extraction-requests`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        cameraIds: [cameraId],
        timeRangeStart: "2026-01-01T08:00:00Z",
        timeRangeEnd: "2026-01-01T09:00:00Z",
        note: "Xin trích xuất",
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.groupId).toBeNull();
    expect(createRes.body.data.requests).toHaveLength(1);
    expect(createRes.body.data.requests[0].status).toBe("pending");

    const listRes = await request(app)
      .get(`/officer/reports/${reportId}/camera-extraction-requests`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].camera.name).toBe("Camera chợ");
  });

  it("400s when timeRangeEnd is before timeRangeStart", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    const cameraId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({
      id: cameraId,
      name: "Camera",
      lat: 12.68,
      lng: 108.05,
      managingUnitName: "A",
      managingUnitContact: "090",
    });

    const res = await request(app)
      .post(`/officer/reports/${reportId}/camera-extraction-requests`)
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`)
      .send({
        cameraIds: [cameraId],
        timeRangeStart: "2026-01-01T09:00:00Z",
        timeRangeEnd: "2026-01-01T08:00:00Z",
      });
    expect(res.status).toBe(400);
  });

  it("creates one request per camera sharing a groupId when several cameras are selected together", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    const camera1 = randomUUID();
    const camera2 = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({ id: camera1, name: "Camera 1", lat: 12.68, lng: 108.05, managingUnitName: "A", managingUnitContact: "090" });
    fakePrisma.seedCamera({ id: camera2, name: "Camera 2", lat: 12.681, lng: 108.051, managingUnitName: "B", managingUnitContact: "091" });

    const res = await request(app)
      .post(`/officer/reports/${reportId}/camera-extraction-requests`)
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`)
      .send({
        cameraIds: [camera1, camera2],
        timeRangeStart: "2026-01-01T17:00:00Z",
        timeRangeEnd: "2026-01-01T18:00:00Z",
        note: "Truy vết tuyến đường",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.groupId).not.toBeNull();
    expect(res.body.data.requests).toHaveLength(2);
  });

  it("400s when cameraIds is empty", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post(`/officer/reports/${randomUUID()}/camera-extraction-requests`)
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({
        cameraIds: [],
        timeRangeStart: "2026-01-01T08:00:00Z",
        timeRangeEnd: "2026-01-01T09:00:00Z",
      });
    expect(res.status).toBe(400);
  });
});
