import { randomBytes, randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import { describe, expect, it } from "vitest";
import { createWebAccountAuthService } from "./webAccountAuth.service.js";
import { hashPassword } from "../crypto/passwordHash.js";
import { encryptField } from "../crypto/aesGcm.js";
import { createFakeWebAccountPrisma, seedFullAccount, type FakeWebAccountPrisma } from "../test-utils/fakeWebAccountPrisma.js";

const PII_KEY = randomBytes(32).toString("base64");

function buildService(fakePrisma: FakeWebAccountPrisma) {
  const issueTokenPairCalls: unknown[] = [];
  const authService = {
    issueTokenPair: async (subject: any) => {
      issueTokenPairCalls.push(subject);
      return { accessToken: "fake-access", refreshToken: "fake-refresh", expiresInMinutes: 20 };
    },
  };
  const auditLogCalls: { officerId: string; action: string; target?: unknown }[] = [];
  const auditLog = {
    record: async (officerId: string, action: string, target?: unknown) => {
      auditLogCalls.push({ officerId, action, target });
    },
  };
  const service = createWebAccountAuthService({
    prisma: fakePrisma as any,
    authService: authService as any,
    piiEncryptionKey: PII_KEY,
    auditLog: auditLog as any,
    webAccountAccessTtlMinutes: 15,
  });
  return { service, issueTokenPairCalls, auditLogCalls };
}

describe("webAccountAuth.service — login", () => {
  it("issues a token pair with the officer's own id/role on correct password", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      role: "senior_officer",
      fullNameEnc: encryptField("[DEMO] Nguyễn Văn A", PII_KEY),
    });

    const { service, issueTokenPairCalls } = buildService(fakePrisma);
    const result = (await service.login("0900001111", "Correct-Horse-1")) as { accessToken: string; mustChangePassword: boolean };

    expect(result.accessToken).toBe("fake-access");
    expect(result.mustChangePassword).toBe(true);
    expect(issueTokenPairCalls).toEqual([{ subjectType: "officer", officerId, role: "senior_officer" }]);
  });

  it("401s with a generic message for a username that doesn't exist", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const { service } = buildService(fakePrisma);
    await expect(service.login("0900009999", "anything")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
  });

  it("401s on a wrong password and increments the failed-attempt counter", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);

    await expect(service.login("0900001111", "wrong")).rejects.toMatchObject({ status: 401 });
    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.failedLoginCount).toBe(1);
  });

  it("locks the account for 15 minutes after 5 failed attempts", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);

    for (let i = 0; i < 5; i++) {
      await expect(service.login("0900001111", "wrong")).rejects.toMatchObject({ status: 401 });
    }

    // The 6th attempt — even with the CORRECT password — is rejected because the account is
    // now locked, not because the password check ran.
    await expect(service.login("0900001111", "Correct-Horse-1")).rejects.toMatchObject({
      status: 429,
      code: "ACCOUNT_LOCKED",
    });
    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.lockedUntil).not.toBeNull();
  });

  it("counts every concurrent wrong-password attempt exactly once (no lost updates)", async () => {
    // Regression test for a race where failedLoginCount was read once then written back
    // `+1` in JS — concurrent requests could all read the same stale count and clobber each
    // other's write, undercounting attempts and blunting the 5-attempt lockout. Fixed via
    // Prisma's atomic `{ increment: 1 }`. verifyPassword's scrypt call genuinely yields the
    // event loop, so Promise.all here interleaves real concurrent login() calls, not just
    // sequential awaits — this would have failed (count < 5) before the fix.
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);

    await Promise.all(
      Array.from({ length: 5 }, () => service.login("0900001111", "wrong").catch((e) => e)),
    );

    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.failedLoginCount).toBe(5);
    expect(account?.lockedUntil).not.toBeNull();
  });

  it("resets the failed-attempt counter on a successful login", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);

    await expect(service.login("0900001111", "wrong")).rejects.toMatchObject({ status: 401 });
    await service.login("0900001111", "Correct-Horse-1");

    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.failedLoginCount).toBe(0);
    expect(account?.lastLoginAt).not.toBeNull();
  });
});

describe("webAccountAuth.service — changePassword", () => {
  it("changes the password and clears mustChangePassword on correct old password", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Old-Password-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
      mustChangePassword: true,
    });
    const { service } = buildService(fakePrisma);

    await service.changePassword(officerId, "Old-Password-1", "New-Password-1");

    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.mustChangePassword).toBe(false);
    // The new password now works for login.
    await service.login("0900001111", "New-Password-1");
  });

  it("401s when the old password is wrong", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Old-Password-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);

    await expect(service.changePassword(officerId, "wrong-old", "New-Password-1")).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("webAccountAuth.service — updateInfo / getMyAccount", () => {
  it("updates full name and unit name, reflected in getMyAccount", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const districtId = randomUUID();
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] Tên cũ", PII_KEY),
      unitName: "Đơn vị cũ",
      districtId,
      districtName: "Buôn Ma Thuột",
    });
    const { service } = buildService(fakePrisma);

    await service.updateInfo(officerId, { fullName: "[DEMO] Tên mới", unitName: "Đơn vị mới" });
    const account = await service.getMyAccount(officerId);

    expect(account.fullName).toBe("[DEMO] Tên mới");
    expect(account.unitName).toBe("Đơn vị mới");
    expect(account.districts).toEqual([{ id: districtId, tenXa: "Buôn Ma Thuột" }]);
    expect(account.mustChangePassword).toBe(true);
  });
});

describe("webAccountAuth.service — admin listWebAccounts / resetPassword", () => {
  it("lists every provisioned account with district names", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
      districtId: randomUUID(),
      districtName: "Buôn Ma Thuột",
    });
    seedFullAccount(fakePrisma, {
      username: "0900002222",
      passwordHash,
      fullNameEnc: encryptField("[DEMO] B", PII_KEY),
      districtId: randomUUID(),
      districtName: "Buôn Hồ",
    });
    const { service, auditLogCalls } = buildService(fakePrisma);
    const adminId = randomUUID();

    const list = await service.listWebAccounts(adminId);
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.username)).toEqual(["0900001111", "0900002222"]);
    expect(list[0]?.districts).toEqual(["Buôn Ma Thuột"]);
    expect(auditLogCalls).toEqual([{ officerId: adminId, action: "view_web_accounts_roster", target: undefined }]);
  });

  it("resets a password: returns a one-time temp password and forces mustChangePassword", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Old-Password-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
      mustChangePassword: false,
    });
    const { service, auditLogCalls } = buildService(fakePrisma);
    const adminId = randomUUID();

    const { tempPassword } = await service.resetPassword(adminId, officerId);
    expect(tempPassword).toHaveLength(10);

    // Old password no longer works; new temp password does, and login flags mustChangePassword.
    await expect(service.login("0900001111", "Old-Password-1")).rejects.toMatchObject({ status: 401 });
    const result = (await service.login("0900001111", tempPassword)) as { mustChangePassword: boolean };
    expect(result.mustChangePassword).toBe(true);

    expect(auditLogCalls).toEqual([
      { officerId: adminId, action: "reset_web_account_password", target: { type: "officer", id: officerId } },
    ]);
  });
});

describe("webAccountAuth.service — TOTP setup/confirm/disable", () => {
  it("stages a secret without enabling 2FA", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);

    const { secret, otpauthUrl } = await service.setupTotp(officerId);

    expect(secret).toHaveLength(16);
    expect(otpauthUrl).toContain("otpauth://totp/");
    expect(otpauthUrl).toContain("0900001111");
    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.totpEnabled).toBe(false);
    expect(account?.totpSecret).not.toBeNull();
  });

  it("confirms with a valid code and flips totpEnabled on", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);
    const { secret } = await service.setupTotp(officerId);

    await service.confirmTotp(officerId, authenticator.generate(secret));

    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.totpEnabled).toBe(true);
  });

  it("401s confirm with a wrong code, leaving totpEnabled false", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
    });
    const { service } = buildService(fakePrisma);
    await service.setupTotp(officerId);

    await expect(service.confirmTotp(officerId, "000000")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_TOTP_CODE",
    });
    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.totpEnabled).toBe(false);
  });

  it("disables 2FA with the correct current password", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const secret = authenticator.generateSecret();
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
      totpSecret: encryptField(secret, PII_KEY),
      totpEnabled: true,
    });
    const { service } = buildService(fakePrisma);

    await service.disableTotp(officerId, "Correct-Horse-1");

    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.totpEnabled).toBe(false);
    expect(account?.totpSecret).toBeNull();
  });

  it("401s disable with the wrong password, leaving 2FA enabled", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const secret = authenticator.generateSecret();
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
      totpSecret: encryptField(secret, PII_KEY),
      totpEnabled: true,
    });
    const { service } = buildService(fakePrisma);

    await expect(service.disableTotp(officerId, "wrong-password")).rejects.toMatchObject({ status: 401 });
    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.totpEnabled).toBe(true);
  });
});

describe("webAccountAuth.service — login with TOTP enabled", () => {
  it("returns requiresTotp + a challengeToken instead of tokens on correct password", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const secret = authenticator.generateSecret();
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
      totpSecret: encryptField(secret, PII_KEY),
      totpEnabled: true,
    });
    const { service, issueTokenPairCalls } = buildService(fakePrisma);

    const result: any = await service.login("0900001111", "Correct-Horse-1");

    expect(result.requiresTotp).toBe(true);
    expect(typeof result.challengeToken).toBe("string");
    expect(result.accessToken).toBeUndefined();
    expect(issueTokenPairCalls).toEqual([]);
  });

  it("loginWithTotp issues tokens on the correct code and consumes the challenge (single-use)", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const secret = authenticator.generateSecret();
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
      totpSecret: encryptField(secret, PII_KEY),
      totpEnabled: true,
    });
    const { service, issueTokenPairCalls } = buildService(fakePrisma);
    const { challengeToken } = (await service.login("0900001111", "Correct-Horse-1")) as any;

    const tokens = await service.loginWithTotp(challengeToken, authenticator.generate(secret));

    expect(tokens.accessToken).toBe("fake-access");
    expect(issueTokenPairCalls).toHaveLength(1);
    // The same challengeToken can't be replayed.
    await expect(service.loginWithTotp(challengeToken, authenticator.generate(secret))).rejects.toMatchObject({
      status: 401,
      code: "INVALID_TOTP_CHALLENGE",
    });
  });

  it("401s loginWithTotp on a wrong code, without issuing tokens", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const passwordHash = await hashPassword("Correct-Horse-1");
    const secret = authenticator.generateSecret();
    seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash,
      fullNameEnc: encryptField("A", PII_KEY),
      totpSecret: encryptField(secret, PII_KEY),
      totpEnabled: true,
    });
    const { service, issueTokenPairCalls } = buildService(fakePrisma);
    const { challengeToken } = (await service.login("0900001111", "Correct-Horse-1")) as any;

    await expect(service.loginWithTotp(challengeToken, "000000")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_TOTP_CODE",
    });
    expect(issueTokenPairCalls).toEqual([]);
  });

  it("401s loginWithTotp on an unknown/expired challengeToken", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const { service } = buildService(fakePrisma);

    await expect(service.loginWithTotp("unknown-token", "123456")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_TOTP_CHALLENGE",
    });
  });
});
