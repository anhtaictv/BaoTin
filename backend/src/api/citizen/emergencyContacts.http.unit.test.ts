import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createEmergencyContactsController } from "./emergencyContacts.controller.js";
import { createEmergencyContactsRoutes } from "./emergencyContacts.routes.js";
import { createEmergencyContactsService } from "../../services/emergencyContacts.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import type { GeoMatchService } from "../../geo/geoMatch.service.js";

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = {
    emergencyContact: {
      async findMany({ where }: any) {
        if (where.districtId === null) {
          return [{ id: "n1", districtId: null, contactType: "police", name: "Công an (toàn quốc)", phoneNumber: "113", note: null }];
        }
        return [];
      },
    },
  };
  const geoMatch: GeoMatchService = { matchDistrict: async () => null, matchNearestDistrict: async () => null };
  const service = createEmergencyContactsService({ prisma: fakePrisma as any, geoMatch });
  const controller = createEmergencyContactsController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const emergencyContactsRouter = createEmergencyContactsRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), emergencyContactsRouter });

  async function tokenFor(role: string) {
    return signAccessToken({ sub: randomUUID(), role }, privateKey, 20);
  }

  return { app, tokenFor };
}

describe("GET /emergency-contacts", () => {
  it("403s an officer token — this endpoint is citizen-only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/emergency-contacts?lat=12.68&lng=108.05")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(403);
  });

  it("returns the national default contacts", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/emergency-contacts?lat=12.68&lng=108.05")
      .set("Authorization", `Bearer ${await tokenFor("citizen")}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { contactType: "police", name: "Công an (toàn quốc)", phoneNumber: "113", note: null, isLocal: false },
    ]);
  });

  it("400s on an out-of-range lat value", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/emergency-contacts?lat=999&lng=108.05")
      .set("Authorization", `Bearer ${await tokenFor("citizen")}`);
    expect(res.status).toBe(400);
  });
});
