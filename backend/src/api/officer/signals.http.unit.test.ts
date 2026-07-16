import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createSignalsController } from "./signals.controller.js";
import { createSignalsRoutes } from "./signals.routes.js";
import { createSignalsService } from "../../services/signals.service.js";
import { createDistrictScopeService } from "../../middleware/districtScope.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { createFakeSignalsPrisma } from "../../test-utils/fakeSignalsPrisma.js";

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeSignalsPrisma();
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const service = createSignalsService({ prisma: fakePrisma as any, districtScope });
  const controller = createSignalsController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const signalsRouter = createSignalsRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), signalsRouter });

  async function tokenFor(role: string, id = randomUUID()) {
    return signAccessToken({ sub: id, role }, privateKey, 20);
  }

  return { app, fakePrisma, tokenFor };
}

describe("GET /officer/signals", () => {
  it("403s a citizen token — this endpoint is officer-only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/officer/signals")
      .set("Authorization", `Bearer ${await tokenFor("citizen")}`);
    expect(res.status).toBe(403);
  });

  it("returns only the officer's own district's signals", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const myDistrict = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: myDistrict, isActive: true });
    fakePrisma.seedSignal({
      id: "mine", sourceName: "Báo A", sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId: myDistrict, detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });
    fakePrisma.seedSignal({
      id: "not-mine", sourceName: "Báo B", sourceUrl: null, trustLevel: "verified_press", summary: null,
      districtId: randomUUID(), detectedCategory: null, publishedAt: new Date(), crawledAt: new Date(), duplicateOfId: null,
    });

    const res = await request(app)
      .get("/officer/signals")
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((s: any) => s.id)).toEqual(["mine"]);
  });

  it("400s on an invalid trust_level query value", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/officer/signals?trust_level=super-trusted")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /officer/signals/:id", () => {
  it("404s for a non-existent signal", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get(`/officer/signals/${randomUUID()}`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);
    expect(res.status).toBe(404);
  });
});
