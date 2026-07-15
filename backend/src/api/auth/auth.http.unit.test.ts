import { randomBytes } from "node:crypto";
import { generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createAuthController } from "./auth.controller.js";
import { createAuthRoutes } from "./auth.routes.js";
import { createAuthService } from "./auth.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys } from "../../crypto/jwtKeys.js";
import { createFakeAuthPrisma } from "../../test-utils/fakeAuthPrisma.js";

/**
 * HTTP-level seam for Slice 1, per the plan: request in, response envelope out — via
 * supertest against the real app.ts wiring (routes, validation, rate limiters), backed
 * by the same in-memory fake Prisma as the service-level tests. No real Postgres needed.
 */
async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeAuthPrisma();
  const authService = createAuthService({
    prisma: fakePrisma as any,
    piiEncryptionKey: randomBytes(32).toString("base64"),
    phoneBlindIndexKey: randomBytes(32).toString("base64"),
    otpPepper: "test-pepper",
    jwtPrivateKey: privateKey,
    jwtAccessTtlMinutes: 20,
    jwtRefreshTtlDays: 30,
    deliverOtp: () => {},
  });
  const authController = createAuthController(authService);
  const requireAuth = createAuthMiddleware(publicKey);
  const authRouter = createAuthRoutes(authController, requireAuth);

  return createApp({ authRouter });
}

// otpRequestLimiter/otpVerifyLimiter are module-level singletons (correct for prod — the
// limit must be shared across requests, not per-test). Each test therefore needs its own
// phone number so it doesn't inherit rate-limit state left over from earlier tests/files.
let phoneCounter = 0;
function uniquePhone(): string {
  phoneCounter += 1;
  return `09${String(10_000_000 + phoneCounter).padStart(8, "0")}`;
}

describe("POST /auth/otp/request + /auth/otp/verify", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  it("returns the standard {success,data,error} envelope on success", async () => {
    const res = await request(app).post("/auth/otp/request").send({ phoneNumber: uniquePhone() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data.otpRequested).toBe(true);
  });

  it("400s on a malformed phone number before touching any service logic", async () => {
    const res = await request(app).post("/auth/otp/request").send({ phoneNumber: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("full round trip: request -> verify -> receives a usable access token", async () => {
    const phoneNumber = uniquePhone();
    const requestRes = await request(app).post("/auth/otp/request").send({ phoneNumber });
    const otp = requestRes.body.data.devOtp;
    expect(otp).toMatch(/^\d{6}$/);

    const verifyRes = await request(app).post("/auth/otp/verify").send({ phoneNumber, otp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
    expect(verifyRes.body.data.refreshToken).toBeTruthy();
  });

  it("401s on a wrong OTP without leaking whether the phone number is registered", async () => {
    const phoneNumber = uniquePhone();
    await request(app).post("/auth/otp/request").send({ phoneNumber });
    const res = await request(app).post("/auth/otp/verify").send({ phoneNumber, otp: "000000" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_OTP");
  });
});

describe("POST /auth/sessions/revoke-all", () => {
  it("401s without a bearer token", async () => {
    const app = await buildTestApp();
    const res = await request(app).post("/auth/sessions/revoke-all").send({});
    expect(res.status).toBe(401);
  });

  it("succeeds with a valid access token from the OTP flow", async () => {
    const app = await buildTestApp();
    const phoneNumber = uniquePhone();
    const requestRes = await request(app).post("/auth/otp/request").send({ phoneNumber });
    const verifyRes = await request(app)
      .post("/auth/otp/verify")
      .send({ phoneNumber, otp: requestRes.body.data.devOtp });

    const res = await request(app)
      .post("/auth/sessions/revoke-all")
      .set("Authorization", `Bearer ${verifyRes.body.data.accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(true);
  });
});
