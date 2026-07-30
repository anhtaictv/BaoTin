import type { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import { HttpError } from "../middleware/errorHandler.js";
import { decryptField, encryptField } from "../crypto/aesGcm.js";
import { generateTempPassword, hashPassword, verifyPassword } from "../crypto/passwordHash.js";
import { generateOpaqueToken } from "../crypto/tokenHash.js";
import type { AuthService } from "../api/auth/auth.service.js";
import type { AuditLogService } from "./auditLog.service.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const TOTP_ISSUER = "Báo Tin";
const TOTP_CHALLENGE_TTL_MS = 5 * 60 * 1000;

// ponytail: single-process in-memory challenge store — the pending 2nd factor never needs to
// survive a restart (worst case the officer just logs in again), and this backend runs as one
// process on one VPS today. Move to the Redis cache (src/cache/cache.ts) if this ever runs
// horizontally scaled across multiple instances.
const pendingTotpChallenges = new Map<string, { officerId: string; expiresAt: number }>();

function pruneExpiredChallenges(): void {
  const now = Date.now();
  for (const [token, challenge] of pendingTotpChallenges) {
    if (challenge.expiresAt <= now) pendingTotpChallenges.delete(token);
  }
}

export interface WebAccountAuthDeps {
  prisma: PrismaClient;
  authService: AuthService;
  piiEncryptionKey: string;
  auditLog: AuditLogService;
  /** dashboard-web-react's own, shorter access-token TTL — see config/env.ts's
   * WEB_ACCOUNT_ACCESS_TTL_MINUTES. */
  webAccountAccessTtlMinutes: number;
}

/**
 * dashboard-web-react's username/password login for the 102 xã/phường web portal — a
 * *separate* auth path from the Flutter officer app's OTP login (auth.service.ts), sharing
 * only issueTokenPair so the resulting JWT is identical either way (same subjectType
 * "officer", same role, same downstream district-scoping). Nothing here touches the OTP
 * flow, otp_challenges, or any existing officer record beyond reading/updating the two
 * plaintext-adjacent columns (full_name_enc, unit_name) that were always officer-owned.
 */
export function createWebAccountAuthService(deps: WebAccountAuthDeps) {
  async function login(username: string, password: string) {
    const account = await deps.prisma.webAccount.findUnique({
      where: { username },
      include: { officer: true },
    });
    // Generic error regardless of whether the username exists — same anti-enumeration
    // rationale as officerLogin in auth.service.ts.
    if (!account) throw new HttpError(401, "INVALID_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu.");

    if (account.lockedUntil && account.lockedUntil > new Date()) {
      throw new HttpError(429, "ACCOUNT_LOCKED", "Tài khoản tạm khoá do nhập sai quá nhiều lần. Vui lòng thử lại sau.");
    }

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) {
      // `{ increment: 1 }` compiles to `SET failed_login_count = failed_login_count + 1` —
      // atomic at the DB row level, unlike reading account.failedLoginCount and writing back
      // `+1` in JS (concurrent guesses could all read the same stale count and clobber each
      // other, undercounting attempts and blunting the lockout). Same race class the OTP path
      // in auth.service.ts guards against for attemptCount.
      const updated = await deps.prisma.webAccount.update({
        where: { id: account.id },
        data: { failedLoginCount: { increment: 1 } },
      });
      if (updated.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
        await deps.prisma.webAccount.update({
          where: { id: account.id },
          data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) },
        });
      }
      throw new HttpError(401, "INVALID_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu.");
    }

    await deps.prisma.webAccount.update({
      where: { id: account.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // TOTP enabled: correct password alone isn't enough — stage a short-lived challenge instead
    // of issuing tokens, and require POST /auth/web/login/totp with the 6-digit code to finish.
    if (account.totpEnabled) {
      pruneExpiredChallenges();
      const challengeToken = generateOpaqueToken();
      pendingTotpChallenges.set(challengeToken, {
        officerId: account.officerId,
        expiresAt: Date.now() + TOTP_CHALLENGE_TTL_MS,
      });
      return { requiresTotp: true as const, challengeToken };
    }

    const tokenPair = await deps.authService.issueTokenPair(
      { subjectType: "officer", officerId: account.officerId, role: account.officer.role },
      deps.webAccountAccessTtlMinutes,
    );

    return { ...tokenPair, mustChangePassword: account.mustChangePassword };
  }

  /** 2nd step of login for an account with totpEnabled — POST /auth/web/login/totp. Consumes
   * the challengeToken login() returned (single-use: deleted whether the code is right or
   * wrong, same anti-replay spirit as OtpChallenge.consumedAt in auth.service.ts). */
  async function loginWithTotp(challengeToken: string, code: string) {
    pruneExpiredChallenges();
    const challenge = pendingTotpChallenges.get(challengeToken);
    if (!challenge) {
      throw new HttpError(401, "INVALID_TOTP_CHALLENGE", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
    pendingTotpChallenges.delete(challengeToken);

    const account = await deps.prisma.webAccount.findUnique({
      where: { officerId: challenge.officerId },
      include: { officer: true },
    });
    if (!account || !account.totpEnabled || !account.totpSecret) {
      throw new HttpError(401, "INVALID_TOTP_CHALLENGE", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }

    const secret = decryptField(account.totpSecret, deps.piiEncryptionKey);
    if (!authenticator.verify({ token: code, secret })) {
      throw new HttpError(401, "INVALID_TOTP_CODE", "Mã xác thực không đúng.");
    }

    await deps.prisma.webAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });

    const tokenPair = await deps.authService.issueTokenPair(
      { subjectType: "officer", officerId: account.officerId, role: account.officer.role },
      deps.webAccountAccessTtlMinutes,
    );

    return { ...tokenPair, mustChangePassword: account.mustChangePassword };
  }

  /** Stages a new TOTP secret (encrypted at rest, same aesGcm.ts helper as phone/name) without
   * enabling 2FA yet — the client renders the returned otpauth:// URI as a QR code, then the
   * officer must prove they scanned it correctly via confirmTotp before it takes effect. */
  async function setupTotp(officerId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const account = await deps.prisma.webAccount.findUnique({ where: { officerId } });
    if (!account) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");

    const secret = authenticator.generateSecret();
    await deps.prisma.webAccount.update({
      where: { id: account.id },
      data: { totpSecret: encryptField(secret, deps.piiEncryptionKey), totpEnabled: false },
    });

    return { secret, otpauthUrl: authenticator.keyuri(account.username, TOTP_ISSUER, secret) };
  }

  /** Verifies the staged secret against a code from the authenticator app and, on success,
   * flips totpEnabled on — the point from which login() starts demanding it. */
  async function confirmTotp(officerId: string, code: string): Promise<void> {
    const account = await deps.prisma.webAccount.findUnique({ where: { officerId } });
    if (!account) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");
    if (!account.totpSecret) {
      throw new HttpError(400, "TOTP_NOT_STAGED", "Chưa khởi tạo TOTP, vui lòng gọi setup trước.");
    }

    const secret = decryptField(account.totpSecret, deps.piiEncryptionKey);
    if (!authenticator.verify({ token: code, secret })) {
      throw new HttpError(401, "INVALID_TOTP_CODE", "Mã xác thực không đúng.");
    }

    await deps.prisma.webAccount.update({ where: { id: account.id }, data: { totpEnabled: true } });
  }

  /** Requires the current password so a stolen/hijacked session alone can't turn off 2FA. */
  async function disableTotp(officerId: string, password: string): Promise<void> {
    const account = await deps.prisma.webAccount.findUnique({ where: { officerId } });
    if (!account) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) throw new HttpError(401, "INVALID_CREDENTIALS", "Mật khẩu không đúng.");

    await deps.prisma.webAccount.update({
      where: { id: account.id },
      data: { totpSecret: null, totpEnabled: false },
    });
  }

  async function changePassword(officerId: string, oldPassword: string, newPassword: string) {
    const account = await deps.prisma.webAccount.findUnique({ where: { officerId } });
    if (!account) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");

    const ok = await verifyPassword(oldPassword, account.passwordHash);
    if (!ok) throw new HttpError(401, "INVALID_CREDENTIALS", "Mật khẩu hiện tại không đúng.");

    const passwordHash = await hashPassword(newPassword);
    await deps.prisma.webAccount.update({
      where: { id: account.id },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  async function updateInfo(officerId: string, input: { fullName?: string; unitName?: string }) {
    await deps.prisma.officer.update({
      where: { id: officerId },
      data: {
        ...(input.fullName ? { fullNameEnc: encryptField(input.fullName, deps.piiEncryptionKey) } : {}),
        ...(input.unitName !== undefined ? { unitName: input.unitName } : {}),
      },
    });
  }

  async function getMyAccount(officerId: string) {
    const account = await deps.prisma.webAccount.findUnique({
      where: { officerId },
      include: {
        officer: {
          include: { assignments: { where: { isActive: true }, include: { district: true } } },
        },
      },
    });
    if (!account) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");

    return {
      username: account.username,
      mustChangePassword: account.mustChangePassword,
      lastLoginAt: account.lastLoginAt,
      fullName: decryptField(account.officer.fullNameEnc, deps.piiEncryptionKey),
      unitName: account.officer.unitName,
      role: account.officer.role,
      districts: account.officer.assignments.map((a) => ({ id: a.district.id, tenXa: a.district.tenXa })),
    };
  }

  /** Admin-only — the full 102-xã roster for the account-management screen.
   * SECURITY.md §1.4: viewing the full account roster (usernames, lock state, last login
   * across every officer) is a sensitive admin action in its own right, audited like
   * officerReports.service.ts's view_identity. */
  async function listWebAccounts(adminOfficerId: string) {
    await deps.auditLog.record(adminOfficerId, "view_web_accounts_roster");

    const accounts = await deps.prisma.webAccount.findMany({
      include: {
        officer: {
          include: { assignments: { where: { isActive: true }, include: { district: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return accounts.map((account) => ({
      officerId: account.officerId,
      username: account.username,
      mustChangePassword: account.mustChangePassword,
      lastLoginAt: account.lastLoginAt,
      isLocked: Boolean(account.lockedUntil && account.lockedUntil > new Date()),
      fullName: decryptField(account.officer.fullNameEnc, deps.piiEncryptionKey),
      unitName: account.officer.unitName,
      role: account.officer.role,
      districts: account.officer.assignments.map((a) => a.district.tenXa),
    }));
  }

  /** Admin-only — generates a new one-time temp password, returned in the response body
   * exactly once and never persisted in plaintext (mirrors the seed script's approach).
   * Forcing another officer's credentials is exactly the kind of "thao tác nhạy cảm" SECURITY.md
   * §1.4 calls out — audited with which admin did it and which account was targeted. */
  async function resetPassword(adminOfficerId: string, officerId: string): Promise<{ tempPassword: string }> {
    const account = await deps.prisma.webAccount.findUnique({ where: { officerId } });
    if (!account) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.");

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await deps.prisma.webAccount.update({
      where: { id: account.id },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    });

    await deps.auditLog.record(adminOfficerId, "reset_web_account_password", { type: "officer", id: officerId });

    return { tempPassword };
  }

  return {
    login,
    loginWithTotp,
    setupTotp,
    confirmTotp,
    disableTotp,
    changePassword,
    updateInfo,
    getMyAccount,
    listWebAccounts,
    resetPassword,
  };
}

export type WebAccountAuthService = ReturnType<typeof createWebAccountAuthService>;
