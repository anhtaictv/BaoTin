import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import { createAuthService } from "./auth.service.js";
import { loadJwtKeys } from "../../crypto/jwtKeys.js";
import { verifyAccessToken } from "../../crypto/jwtKeys.js";
import { hashPhoneNumber } from "../../crypto/phoneBlindIndex.js";
import { createFakeAuthPrisma } from "../../test-utils/fakeAuthPrisma.js";

async function setup() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = await exportPKCS8(priv as never);
  const publicKeyPem = await exportSPKI(pub as never);
  const { privateKey, publicKey } = await loadJwtKeys(privateKeyPem, publicKeyPem);

  const fakePrisma = createFakeAuthPrisma();
  const piiEncryptionKey = randomBytes(32).toString("base64");
  const phoneBlindIndexKey = randomBytes(32).toString("base64");

  const service = createAuthService({
    prisma: fakePrisma as any,
    piiEncryptionKey,
    phoneBlindIndexKey,
    otpPepper: "test-pepper",
    jwtPrivateKey: privateKey,
    jwtAccessTtlMinutes: 20,
    jwtRefreshTtlDays: 30,
    deliverOtp: () => {}, // silence the console stub in test output
  });

  return { service, fakePrisma, publicKey, phoneBlindIndexKey };
}

describe("auth.service — citizen OTP flow", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("issues a token pair after a correct OTP verify", async () => {
    const { devOtp } = await ctx.service.requestOtpForUser("0912345678");
    expect(devOtp).toMatch(/^\d{6}$/);

    const tokens = await ctx.service.verifyOtpForUser("0912345678", devOtp!);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const payload = await verifyAccessToken(tokens.accessToken, ctx.publicKey);
    expect(payload.role).toBe("citizen");
  });

  it("rejects an incorrect OTP without issuing tokens", async () => {
    await ctx.service.requestOtpForUser("0912345678");
    await expect(ctx.service.verifyOtpForUser("0912345678", "000000")).rejects.toThrow(/OTP/);
  });

  it("locks out after 5 wrong attempts against the same challenge", async () => {
    await ctx.service.requestOtpForUser("0912345678");
    for (let i = 0; i < 5; i++) {
      await expect(ctx.service.verifyOtpForUser("0912345678", "000000")).rejects.toThrow();
    }
    // 6th attempt (even if somehow the OTP were guessed) should report locked, not "invalid".
    await expect(ctx.service.verifyOtpForUser("0912345678", "000000")).rejects.toThrow(/nhiều lần|locked/i);
  });

  it("upserts the same user on repeated OTP requests (no duplicate accounts)", async () => {
    await ctx.service.requestOtpForUser("0912345678");
    await ctx.service.requestOtpForUser("0912345678");
    expect(ctx.fakePrisma.store.users.size).toBe(1);
  });

  it("stores the phone number only in encrypted form, never in plaintext", async () => {
    await ctx.service.requestOtpForUser("0912345678");
    const user = [...ctx.fakePrisma.store.users.values()][0];
    expect(user.phoneNumberEnc).not.toContain("0912345678");
    expect(ctx.service.decryptPhoneNumber(user.phoneNumberEnc)).toBe("0912345678");
  });
});

describe("auth.service — refresh token rotation", () => {
  it("rotates: old refresh token is invalidated the instant a new one is issued", async () => {
    const ctx = await setup();
    const { devOtp } = await ctx.service.requestOtpForUser("0912345678");
    const tokens = await ctx.service.verifyOtpForUser("0912345678", devOtp!);

    const rotated = await ctx.service.rotateRefreshToken(tokens.refreshToken);
    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);

    // The old refresh token must no longer work (replay-attack resistance).
    await expect(ctx.service.rotateRefreshToken(tokens.refreshToken)).rejects.toThrow();
  });

  it("revokeAllSessions invalidates every active refresh token for the subject", async () => {
    const ctx = await setup();
    const { devOtp } = await ctx.service.requestOtpForUser("0912345678");
    const tokens = await ctx.service.verifyOtpForUser("0912345678", devOtp!);

    const phoneHash = hashPhoneNumber("0912345678", ctx.phoneBlindIndexKey);
    const user = [...ctx.fakePrisma.store.users.values()].find((u) => u.phoneHash === phoneHash);

    await ctx.service.revokeAllSessions("user", user.id);
    await expect(ctx.service.rotateRefreshToken(tokens.refreshToken)).rejects.toThrow();
  });
});

describe("auth.service — officer login (single endpoint, two modes)", () => {
  it("requires a pre-provisioned officer — never auto-creates one", async () => {
    const ctx = await setup();
    await expect(ctx.service.officerLogin("0900000001")).rejects.toThrow(/không thể|credentials/i);
  });

  it("issues an officer token pair after correct OTP, carrying the officer's role", async () => {
    const ctx = await setup();
    const phoneHash = hashPhoneNumber("0900000001", ctx.phoneBlindIndexKey);
    const officer = {
      id: randomUUID(),
      phoneHash,
      role: "officer",
      phoneNumberEnc: "n/a",
      fullNameEnc: "n/a",
    };
    ctx.fakePrisma.store.officers.set(officer.id, officer);

    const { devOtp } = (await ctx.service.officerLogin("0900000001")) as { devOtp: string };
    const tokens = (await ctx.service.officerLogin("0900000001", devOtp)) as {
      accessToken: string;
      refreshToken: string;
    };

    const payload = await verifyAccessToken(tokens.accessToken, ctx.publicKey);
    expect(payload.role).toBe("officer");
    expect(payload.subjectType).toBe("officer");
  });
});
