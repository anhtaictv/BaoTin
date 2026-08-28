import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createCommuneAssignmentController } from "./communeAssignment.controller.js";
import { createCommuneAssignmentRoutes } from "./communeAssignment.routes.js";
import type { CommuneAssignmentService } from "../../services/communeAssignment.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";

async function buildTestApp(serviceOverrides: Partial<CommuneAssignmentService> = {}) {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const service: CommuneAssignmentService = {
    getCommuneHeadDistrict: async () => null,
    assertCanManageDistrict: async () => {},
    listOldWardsForDistrict: async () => [],
    listSubordinates: async () => [],
    assignSubordinateOldDistrict: async () => {},
    ...serviceOverrides,
  };
  const controller = createCommuneAssignmentController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const communeAssignmentRouter = createCommuneAssignmentRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), communeAssignmentRouter });

  async function tokenFor(role: string) {
    return signAccessToken({ sub: randomUUID(), role }, privateKey, 20);
  }

  return { app, tokenFor };
}

describe("GET /officer/commune/:districtId/old-wards", () => {
  it("401s without a bearer token", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get(`/officer/commune/${randomUUID()}/old-wards`);
    expect(res.status).toBe(401);
  });

  it("200s for every officer role — read-only", async () => {
    const { app, tokenFor } = await buildTestApp();
    for (const role of ["officer", "senior_officer", "commune_head", "admin"]) {
      const res = await request(app)
        .get(`/officer/commune/${randomUUID()}/old-wards`)
        .set("Authorization", `Bearer ${await tokenFor(role)}`);
      expect(res.status).toBe(200);
    }
  });

  it("400s on a malformed districtId", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/officer/commune/not-a-uuid/old-wards")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /officer/commune/:districtId/subordinates/:officerId/assignment", () => {
  it("403s a plain officer — assignment is commune_head/admin only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post(`/officer/commune/${randomUUID()}/subordinates/${randomUUID()}/assignment`)
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ oldDistrictId: randomUUID() });
    expect(res.status).toBe(403);
  });

  it("403s a senior_officer too — read-only role", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post(`/officer/commune/${randomUUID()}/subordinates/${randomUUID()}/assignment`)
      .set("Authorization", `Bearer ${await tokenFor("senior_officer")}`)
      .send({ oldDistrictId: randomUUID() });
    expect(res.status).toBe(403);
  });

  it("403s when the service rejects a commune_head assigning outside their own district", async () => {
    const { app, tokenFor } = await buildTestApp({
      assignSubordinateOldDistrict: async () => {
        const { HttpError } = await import("../../middleware/errorHandler.js");
        throw new HttpError(403, "FORBIDDEN", "Trưởng xã chỉ được phân địa bàn trong xã/phường mình phụ trách.");
      },
    });
    const res = await request(app)
      .post(`/officer/commune/${randomUUID()}/subordinates/${randomUUID()}/assignment`)
      .set("Authorization", `Bearer ${await tokenFor("commune_head")}`)
      .send({ oldDistrictId: randomUUID() });
    expect(res.status).toBe(403);
  });

  it("200s for commune_head and admin, accepting a null oldDistrictId to clear the sub-area", async () => {
    let calledWith: unknown = null;
    const { app, tokenFor } = await buildTestApp({
      assignSubordinateOldDistrict: async (actor, districtId, officerId, oldDistrictId) => {
        calledWith = { actor, districtId, officerId, oldDistrictId };
      },
    });
    const districtId = randomUUID();
    const officerId = randomUUID();
    const res = await request(app)
      .post(`/officer/commune/${districtId}/subordinates/${officerId}/assignment`)
      .set("Authorization", `Bearer ${await tokenFor("commune_head")}`)
      .send({ oldDistrictId: null });
    expect(res.status).toBe(200);
    expect(calledWith).toMatchObject({ districtId, officerId, oldDistrictId: null });
  });

  it("400s on a body missing oldDistrictId", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post(`/officer/commune/${randomUUID()}/subordinates/${randomUUID()}/assignment`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
