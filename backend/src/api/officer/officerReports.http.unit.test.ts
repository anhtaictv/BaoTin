import { randomBytes, randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createOfficerReportsController } from "./officerReports.controller.js";
import { createOfficerReportsRoutes } from "./officerReports.routes.js";
import { createOfficerReportsService } from "../../services/officerReports.service.js";
import { createDistrictScopeService } from "../../middleware/districtScope.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { createFakeOfficerPrisma } from "../../test-utils/fakeOfficerPrisma.js";

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeOfficerPrisma();
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const officialCaseLink = { pushToOfficialCase: async () => {} };
  const auditLog = { record: async () => {} };
  const storage = { putObject: async () => {}, getPresignedGetUrl: async (key: string) => `https://minio.local/${key}` };
  const notifications = {
    notifyOfficerOfNewReport: async () => new Date(),
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async () => new Date(),
  };
  const service = createOfficerReportsService({
    prisma: fakePrisma as any,
    districtScope,
    officialCaseLink,
    auditLog,
    storage,
    notifications,
    piiEncryptionKey: randomBytes(32).toString("base64"),
  });
  const controller = createOfficerReportsController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const officerReportsRouter = createOfficerReportsRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), officerReportsRouter });

  async function tokenFor(role: string, id = randomUUID()) {
    return signAccessToken({ sub: id, role }, privateKey, 20);
  }

  return { app, fakePrisma, tokenFor };
}

describe("GET /officer/reports", () => {
  it("403s a citizen token — this endpoint is officer-only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/officer/reports")
      .set("Authorization", `Bearer ${await tokenFor("citizen")}`);
    expect(res.status).toBe(403);
  });

  it("returns only the officer's own district's reports", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const myDistrict = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: myDistrict, isActive: true });
    fakePrisma.seedReport({
      id: "mine", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId: myDistrict, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });
    fakePrisma.seedReport({
      id: "not-mine", category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId: randomUUID(), createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const res = await request(app)
      .get("/officer/reports")
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((r: any) => r.id)).toEqual(["mine"]);
  });

  it("400s on an invalid urgency query value", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/officer/reports?urgency=super-urgent")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /officer/reports/:id/status", () => {
  it("updates status and rejects re-verifying a report outside the officer's district", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportInDistrict = randomUUID();
    const reportOutsideDistrict = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: reportInDistrict, category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });
    fakePrisma.seedReport({
      id: reportOutsideDistrict, category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId: randomUUID(), createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });
    const token = await tokenFor("officer", officerId);

    const ok = await request(app)
      .patch(`/officer/reports/${reportInDistrict}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "verifying" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("verifying");

    const blocked = await request(app)
      .patch(`/officer/reports/${reportOutsideDistrict}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "verifying" });
    expect(blocked.status).toBe(403);
  });

  it("400s if the status value is 'pending' (not a valid officer-chosen transition)", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({
      id: reportId, category: null, urgency: "normal", status: "pending", source: "citizen",
      districtId, createdAt: new Date(), verifiedAt: null, responseTimeSeconds: null,
    });

    const res = await request(app)
      .patch(`/officer/reports/${reportId}/status`)
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`)
      .send({ status: "pending" });
    expect(res.status).toBe(400);
  });
});
