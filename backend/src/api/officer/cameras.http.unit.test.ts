import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createCamerasController } from "./cameras.controller.js";
import { createCamerasRoutes, createDistrictCamerasRoutes } from "./cameras.routes.js";
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
  const districtCamerasRouter = createDistrictCamerasRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), camerasRouter, districtCamerasRouter });

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

  it("flags whether each camera's own facing direction actually covers the report location", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    // ~100m due north of the report — bearing from camera to report is ~180° (south).
    const cameraPos = { lat: BUON_MA_THUOT.lat + 0.0009, lng: BUON_MA_THUOT.lng };
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera hướng đúng",
      ...cameraPos,
      managingUnitName: null,
      managingUnitContact: null,
      directionDegrees: 180,
      fovDegrees: 60,
    });
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera hướng sai",
      ...cameraPos,
      managingUnitName: null,
      managingUnitContact: null,
      directionDegrees: 0,
      fovDegrees: 60,
    });
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera chưa rõ hướng",
      ...cameraPos,
      managingUnitName: null,
      managingUnitContact: null,
    });

    const res = await request(app)
      .get(`/officer/reports/${reportId}/nearby-cameras?radius_m=1000`)
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);

    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.data.map((c: { name: string; facesLocation: unknown }) => [c.name, c.facesLocation]));
    expect(byName["Camera hướng đúng"]).toBe(true);
    expect(byName["Camera hướng sai"]).toBe(false);
    expect(byName["Camera chưa rõ hướng"]).toBeNull();
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

describe("GET /officer/cameras", () => {
  it("returns only cameras in the officer's own assigned district(s), with direction/fov", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const ownDistrict = randomUUID();
    const otherDistrict = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: ownDistrict, isActive: true });
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera trong địa bàn",
      lat: 12.68,
      lng: 108.05,
      managingUnitName: "Công an phường",
      managingUnitContact: "0900000001",
      districtId: ownDistrict,
      directionDegrees: 135,
      fovDegrees: 80,
    });
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera địa bàn khác",
      lat: 12.9,
      lng: 108.2,
      managingUnitName: "Công an phường khác",
      managingUnitContact: "0900000002",
      districtId: otherDistrict,
      directionDegrees: 0,
      fovDegrees: 90,
    });

    const res = await request(app)
      .get("/officer/cameras")
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Camera trong địa bàn");
    expect(res.body.data[0].directionDegrees).toBe(135);
    expect(res.body.data[0].fovDegrees).toBe(80);
  });

  it("returns every camera for an unrestricted role (senior_officer/admin)", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera A",
      lat: 12.68,
      lng: 108.05,
      managingUnitName: null,
      managingUnitContact: null,
      districtId: randomUUID(),
    });
    fakePrisma.seedCamera({
      id: randomUUID(),
      name: "Camera B",
      lat: 12.9,
      lng: 108.2,
      managingUnitName: null,
      managingUnitContact: null,
      districtId: randomUUID(),
    });

    const res = await request(app)
      .get("/officer/cameras")
      .set("Authorization", `Bearer ${await tokenFor("senior_officer")}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("401s without a token", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get("/officer/cameras");
    expect(res.status).toBe(401);
  });
});

describe("POST /officer/cameras", () => {
  const validPayload = {
    name: "[DEMO] Camera mới",
    lat: 12.68,
    lng: 108.05,
    managingUnitName: "Công an phường",
    managingUnitContact: "0900000009",
    directionDegrees: 90,
    fovDegrees: 80,
  };

  it("lets an admin register a camera, which then shows up in the district list", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const districtId = randomUUID();
    fakePrisma.seedDistrict(districtId);

    const createRes = await request(app)
      .post("/officer/cameras")
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({ ...validPayload, districtId });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe("[DEMO] Camera mới");
    expect(createRes.body.data.directionDegrees).toBe(90);

    const listRes = await request(app)
      .get("/officer/cameras")
      .set("Authorization", `Bearer ${await tokenFor("senior_officer")}`);
    expect(listRes.body.data).toHaveLength(1);
  });

  it("403s for a plain officer — camera registration is admin/senior_officer only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post("/officer/cameras")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ ...validPayload, districtId: randomUUID() });
    expect(res.status).toBe(403);
  });

  it("400s when required fields are missing or out of range", async () => {
    const { app, tokenFor } = await buildTestApp();
    const token = await tokenFor("admin");

    const missingName = await request(app)
      .post("/officer/cameras")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validPayload, name: "", districtId: randomUUID() });
    expect(missingName.status).toBe(400);

    const badDirection = await request(app)
      .post("/officer/cameras")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validPayload, directionDegrees: 400, districtId: randomUUID() });
    expect(badDirection.status).toBe(400);
  });

  it("400s (not a raw 500) when districtId is well-formed but doesn't exist", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post("/officer/cameras")
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({ ...validPayload, districtId: randomUUID() });
    expect(res.status).toBe(400);
  });
});

describe("PUT /officer/cameras/:id", () => {
  it("replaces every field on an existing camera", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const cameraId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedDistrict(districtId);
    fakePrisma.seedCamera({
      id: cameraId,
      name: "Tên cũ",
      lat: 12.68,
      lng: 108.05,
      managingUnitName: "Đơn vị cũ",
      managingUnitContact: "0900000001",
      districtId,
    });

    const res = await request(app)
      .put(`/officer/cameras/${cameraId}`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({
        name: "Tên mới",
        lat: 12.9,
        lng: 108.2,
        managingUnitName: "Đơn vị mới",
        managingUnitContact: "0900000002",
        districtId,
        directionDegrees: 200,
        fovDegrees: 70,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Tên mới");
    expect(res.body.data.directionDegrees).toBe(200);
    expect(fakePrisma.store.cameras.get(cameraId)?.name).toBe("Tên mới");
  });

  it("404s for an unknown camera id", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .put(`/officer/cameras/${randomUUID()}`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({ name: "X", lat: 12.68, lng: 108.05, districtId: randomUUID() });
    expect(res.status).toBe(404);
  });

  it("403s for a plain officer", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const cameraId = randomUUID();
    fakePrisma.seedCamera({ id: cameraId, name: "X", lat: 12.68, lng: 108.05, managingUnitName: null, managingUnitContact: null });

    const res = await request(app)
      .put(`/officer/cameras/${cameraId}`)
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ name: "Y", lat: 12.68, lng: 108.05, districtId: randomUUID() });
    expect(res.status).toBe(403);
  });

  it("400s (not a raw 500) when the new districtId doesn't exist", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const cameraId = randomUUID();
    fakePrisma.seedCamera({ id: cameraId, name: "X", lat: 12.68, lng: 108.05, managingUnitName: null, managingUnitContact: null });

    const res = await request(app)
      .put(`/officer/cameras/${cameraId}`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({ name: "Y", lat: 12.68, lng: 108.05, districtId: randomUUID() });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /officer/cameras/:id", () => {
  it("lets an admin delete a camera with no dependent rows", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const cameraId = randomUUID();
    fakePrisma.seedCamera({ id: cameraId, name: "X", lat: 12.68, lng: 108.05, managingUnitName: null, managingUnitContact: null });

    const res = await request(app)
      .delete(`/officer/cameras/${cameraId}`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);

    expect(res.status).toBe(200);
    expect(fakePrisma.store.cameras.has(cameraId)).toBe(false);
  });

  it("409s instead of crashing when the camera has an existing extraction request", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const cameraId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedCamera({ id: cameraId, name: "X", lat: 12.68, lng: 108.05, managingUnitName: null, managingUnitContact: null });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.store.extractionRequests.push({ id: randomUUID(), reportId, cameraId, createdAt: new Date() });

    const res = await request(app)
      .delete(`/officer/cameras/${cameraId}`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);

    expect(res.status).toBe(409);
    expect(fakePrisma.store.cameras.has(cameraId)).toBe(true);
  });

  it("404s for an unknown camera id", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .delete(`/officer/cameras/${randomUUID()}`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);
    expect(res.status).toBe(404);
  });

  it("403s for a plain officer", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const cameraId = randomUUID();
    fakePrisma.seedCamera({ id: cameraId, name: "X", lat: 12.68, lng: 108.05, managingUnitName: null, managingUnitContact: null });

    const res = await request(app)
      .delete(`/officer/cameras/${cameraId}`)
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(403);
  });
});
