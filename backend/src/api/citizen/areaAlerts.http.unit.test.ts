import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createAreaAlertsController } from "./areaAlerts.controller.js";
import { createAreaAlertsRoutes } from "./areaAlerts.routes.js";
import { createAreaAlertsService } from "../../services/areaAlerts.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import type { GeoMatchService } from "../../geo/geoMatch.service.js";

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const districtId = randomUUID();
  const fakePrisma = {
    report: {
      async groupBy() {
        return [];
      },
    },
    async $queryRaw() {
      return [{ id: districtId, tenXa: "Buôn Ma Thuột", lat: 12.68, lng: 108.05 }];
    },
    officerBroadcastAlert: {
      async findMany() {
        return [];
      },
    },
  };
  const geoMatch: GeoMatchService = { matchDistrict: async () => districtId, matchNearestDistrict: async () => districtId };
  const service = createAreaAlertsService({ prisma: fakePrisma as any, geoMatch });
  const controller = createAreaAlertsController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const areaAlertsRouter = createAreaAlertsRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), areaAlertsRouter });

  async function tokenFor(role: string) {
    return signAccessToken({ sub: randomUUID(), role }, privateKey, 20);
  }

  return { app, tokenFor, districtId };
}

describe("GET /area-alerts", () => {
  it("403s an officer token — this endpoint is citizen-only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/area-alerts?lat=12.68&lng=108.05")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(403);
  });

  it("returns aggregated district alerts, never an individual report", async () => {
    const { app, tokenFor, districtId } = await buildTestApp();
    const res = await request(app)
      .get("/area-alerts?lat=12.68&lng=108.05")
      .set("Authorization", `Bearer ${await tokenFor("citizen")}`);
    expect(res.status).toBe(200);
    expect(res.body.data.myDistrictId).toBe(districtId);
    expect(res.body.data.districts).toEqual([
      { districtId, tenXa: "Buôn Ma Thuột", centroidLat: 12.68, centroidLng: 108.05, reportCount: 0, alertLevel: "low" },
    ]);
  });

  it("400s on a missing lng value", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/area-alerts?lat=12.68")
      .set("Authorization", `Bearer ${await tokenFor("citizen")}`);
    expect(res.status).toBe(400);
  });
});
