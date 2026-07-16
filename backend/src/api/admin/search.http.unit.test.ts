import { randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createSearchController } from "./search.controller.js";
import { createSearchRoutes } from "./search.routes.js";
import { createSearchAssistantService } from "../../services/searchAssistant.service.js";
import type { QueryInterpreter } from "../../services/searchInterpreter.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";

async function buildTestApp(interpreter?: QueryInterpreter) {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = {
    district: { async findMany() { return []; } },
    report: { async findMany() { return []; } },
    socialMediaSignal: { async findMany() { return []; } },
  };
  const service = createSearchAssistantService({
    prisma: fakePrisma as any,
    interpreter: interpreter ?? { interpret: async () => null },
  });
  const controller = createSearchController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const searchRouter = createSearchRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), searchRouter });

  async function tokenFor(role: string) {
    return signAccessToken({ sub: randomUUID(), role }, privateKey, 20);
  }

  return { app, tokenFor };
}

describe("POST /admin/search", () => {
  it("403s a plain officer token — search is admin/senior_officer only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post("/admin/search")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ query: "tin cháy nổ" });
    expect(res.status).toBe(403);
  });

  it("401s without a bearer token", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).post("/admin/search").send({ query: "tin cháy nổ" });
    expect(res.status).toBe(401);
  });

  it("400s when query is missing", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post("/admin/search")
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("200s for admin and senior_officer, returning available: false when the interpreter can't parse", async () => {
    const { app, tokenFor } = await buildTestApp();
    for (const role of ["admin", "senior_officer"]) {
      const res = await request(app)
        .post("/admin/search")
        .set("Authorization", `Bearer ${await tokenFor(role)}`)
        .send({ query: "tin cháy nổ" });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ available: false, interpreted: null, reports: [], signals: [] });
    }
  });

  it("returns available: true with the interpreted filters when the interpreter parses successfully", async () => {
    const interpreter: QueryInterpreter = {
      interpret: async () => ({ districtName: null, sinceDays: 30, keyword: "cháy nổ" }),
    };
    const { app, tokenFor } = await buildTestApp(interpreter);
    const res = await request(app)
      .post("/admin/search")
      .set("Authorization", `Bearer ${await tokenFor("admin")}`)
      .send({ query: "tin cháy nổ tháng trước" });

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.interpreted).toEqual({ districtName: null, sinceDays: 30, keyword: "cháy nổ" });
  });
});
