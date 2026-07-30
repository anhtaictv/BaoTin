import { randomBytes, randomUUID, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createWebAccountController } from "./webAccount.controller.js";
import { createWebAccountRoutes } from "./webAccount.routes.js";
import { createWebAccountAuthService } from "../../services/webAccountAuth.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { hashPassword } from "../../crypto/passwordHash.js";
import { encryptField } from "../../crypto/aesGcm.js";
import { createFakeWebAccountPrisma, seedFullAccount } from "../../test-utils/fakeWebAccountPrisma.js";

const PII_KEY = randomBytes(32).toString("base64");

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeWebAccountPrisma();
  const authService = {
    issueTokenPair: async (subject: { officerId?: string; role: string }) => ({
      accessToken: await signAccessToken(
        { sub: subject.officerId, role: subject.role, subjectType: "officer" },
        privateKey,
        20,
      ),
      refreshToken: "fake-refresh",
      expiresInMinutes: 20,
    }),
  };
  const auditLog = { record: async () => {} };
  const service = createWebAccountAuthService({
    prisma: fakePrisma as any,
    authService: authService as any,
    piiEncryptionKey: PII_KEY,
    auditLog: auditLog as any,
    webAccountAccessTtlMinutes: 15,
  });
  const controller = createWebAccountController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const webAccountRouter = createWebAccountRoutes(controller, requireAuth);

  const { Router } = await import("express");
  const app = createApp({ authRouter: Router(), webAccountRouter });

  async function tokenFor(role: string, id: string = randomUUID()) {
    return signAccessToken({ sub: id, role, subjectType: "officer" }, privateKey, 20);
  }

  return { app, fakePrisma, tokenFor };
}

describe("POST /auth/web/login", () => {
  it("200s and returns a token pair + mustChangePassword on correct credentials", async () => {
    const { app, fakePrisma } = await buildTestApp();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });

    const res = await request(app).post("/auth/web/login").send({ username: "0900001111", password: "Correct-Horse-1" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  it("401s on a wrong password", async () => {
    const { app, fakePrisma } = await buildTestApp();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });

    const res = await request(app).post("/auth/web/login").send({ username: "0900001111", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("400s when username/password is missing", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).post("/auth/web/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /web-accounts/me", () => {
  it("401s without a bearer token", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get("/web-accounts/me");
    expect(res.status).toBe(401);
  });

  it("200s and returns the caller's own account for an authenticated officer", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });

    const res = await request(app)
      .get("/web-accounts/me")
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("0900001111");
  });
});

describe("PATCH /web-accounts/me/password", () => {
  it("400s when newPassword is too short", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .patch("/web-accounts/me/password")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ oldPassword: "x", newPassword: "short" });
    expect(res.status).toBe(400);
  });

  it("200s and changes the password on correct old password", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const passwordHash = await hashPassword("Old-Password-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });

    const res = await request(app)
      .patch("/web-accounts/me/password")
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`)
      .send({ oldPassword: "Old-Password-1", newPassword: "New-Password-1" });
    expect(res.status).toBe(200);
  });

  it("400s a 12+ char newPassword that lacks complexity (no uppercase/special char)", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .patch("/web-accounts/me/password")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ oldPassword: "x", newPassword: "lowercaseonly123" });
    expect(res.status).toBe(400);
  });
});

describe("GET /admin/web-accounts", () => {
  it("403s a plain officer token — admin only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/admin/web-accounts")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(403);
  });

  it("200s for an admin token", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });

    const res = await request(app)
      .get("/admin/web-accounts")
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe("POST /admin/web-accounts/:officerId/reset-password", () => {
  it("403s a plain officer token — admin only", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post(`/admin/web-accounts/${randomUUID()}/reset-password`)
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(403);
  });

  it("200s and returns a one-time temp password for an admin token", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const passwordHash = await hashPassword("Old-Password-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });

    const res = await request(app)
      .post(`/admin/web-accounts/${officerId}/reset-password`)
      .set("Authorization", `Bearer ${await tokenFor("admin")}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tempPassword).toHaveLength(10);
  });
});
