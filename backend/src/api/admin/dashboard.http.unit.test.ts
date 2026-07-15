import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createDashboardController } from "./dashboard.controller.js";
import { createDashboardRoutes } from "./dashboard.routes.js";
import { createDashboardStatsService } from "../../services/dashboardStats.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { createFakeDashboardPrisma } from "../../test-utils/fakeDashboardPrisma.js";

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeDashboardPrisma();
  const service = createDashboardStatsService({ prisma: fakePrisma as any, piiEncryptionKey: "k".repeat(44) });
  const controller = createDashboardController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const dashboardRouter = createDashboardRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), dashboardRouter });

  async function tokenFor(role: string) {
    return signAccessToken({ sub: randomUUID(), role }, privateKey, 20);
  }

  return { app, fakePrisma, tokenFor };
}

describe("GET /admin/dashboard/*", () => {
  it("403s a plain officer token — dashboard is admin/senior_officer only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/admin/dashboard/overview")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(403);
  });

  it("200s for admin and senior_officer roles", async () => {
    const { app, tokenFor } = await buildTestApp();
    for (const role of ["admin", "senior_officer"]) {
      const res = await request(app)
        .get("/admin/dashboard/overview")
        .set("Authorization", `Bearer ${await tokenFor(role)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalReports).toBe(0);
    }
  });

  it("400s on an out-of-range days value", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/admin/dashboard/volume-trend?days=9999")
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);
    expect(res.status).toBe(400);
  });

  it("camera-queue returns an object keyed by status", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    fakePrisma.seedExtractionRequest({ id: "e1", status: "pending" });

    const res = await request(app)
      .get("/admin/dashboard/camera-queue")
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ pending: 1 });
  });
});
