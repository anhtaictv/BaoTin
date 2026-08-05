import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createTrafficAccidentsController } from "./trafficAccidents.controller.js";
import { createTrafficAccidentIngestRoutes } from "./trafficAccidentIngest.routes.js";
import { createTrafficAccidentAlertsRoutes } from "../officer/trafficAccidentAlerts.routes.js";
import { createTrafficAccidentAlertsService } from "../../services/trafficAccidentAlerts.service.js";
import { createDistrictScopeService } from "../../middleware/districtScope.js";
import { createAssignOfficerService } from "../../geo/assignOfficer.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { createDetectorApiKeyMiddleware } from "../../middleware/detectorApiKey.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { createFakeTrafficAccidentPrisma } from "../../test-utils/fakeTrafficAccidentPrisma.js";

const DETECTOR_API_KEY = "test-detector-key";

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeTrafficAccidentPrisma();
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const assignOfficer = createAssignOfficerService(fakePrisma as any);
  const storage = {
    putObject: async () => {},
    getPresignedGetUrl: async (key: string) => `https://minio.local/${key}`,
    removeObject: async () => {},
  };
  const notifications = {
    notifyOfficerOfNewReport: async () => new Date(),
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async () => new Date(),
    notifyOfficerOfChatMessage: async () => new Date(),
    notifyUserOfDistrictBroadcast: async () => new Date(),
  };
  const service = createTrafficAccidentAlertsService({
    prisma: fakePrisma as any,
    districtScope,
    assignOfficer,
    storage,
    notifications,
  });
  const controller = createTrafficAccidentsController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const requireDetectorApiKey = createDetectorApiKeyMiddleware(DETECTOR_API_KEY);
  const trafficAccidentIngestRouter = createTrafficAccidentIngestRoutes(controller, requireDetectorApiKey);
  const trafficAccidentAlertsRouter = createTrafficAccidentAlertsRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), trafficAccidentIngestRouter, trafficAccidentAlertsRouter });

  async function tokenFor(role: string, id = randomUUID()) {
    return signAccessToken({ sub: id, role }, privateKey, 20);
  }

  return { app, fakePrisma, tokenFor };
}

describe("POST /detections/traffic-accidents", () => {
  it("rejects a request without the detector API key", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).post("/detections/traffic-accidents").field("cameraId", randomUUID());
    expect(res.status).toBe(401);
  });

  it("accepts a valid detection and creates a pending alert", async () => {
    const { app, fakePrisma } = await buildTestApp();
    const cameraId = randomUUID();
    fakePrisma.seedCamera({ id: cameraId, districtId: "district-1" });
    fakePrisma.seedAssignment({ officerId: randomUUID(), districtId: "district-1", isActive: true });

    const res = await request(app)
      .post("/detections/traffic-accidents")
      .set("X-Detector-Api-Key", DETECTOR_API_KEY)
      .field("cameraId", cameraId)
      .field("plateNumbers", "51H-123.45, 47C-678.90");

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
  });
});

describe("GET /officer/traffic-accident-alerts", () => {
  it("403s a citizen token — officer-only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/officer/traffic-accident-alerts")
      .set("Authorization", `Bearer ${await tokenFor("citizen")}`);
    expect(res.status).toBe(403);
  });

  it("lists alerts and lets an officer confirm one", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const cameraId = randomUUID();
    const officerId = randomUUID();
    fakePrisma.seedCamera({ id: cameraId, districtId: "district-1" });
    fakePrisma.seedAssignment({ officerId, districtId: "district-1", isActive: true });
    const alert = await fakePrisma.trafficAccidentAlert.create({
      data: { cameraId, districtId: "district-1", assignedOfficerId: officerId },
    });

    const token = await tokenFor("officer", officerId);
    const listRes = await request(app).get("/officer/traffic-accident-alerts").set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const confirmRes = await request(app)
      .post(`/officer/traffic-accident-alerts/${alert.id}/confirm`)
      .set("Authorization", `Bearer ${token}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("confirmed");
  });
});
