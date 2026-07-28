import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import { decryptField, encryptField } from "../crypto/aesGcm.js";
import { generateTempPassword, hashPassword, verifyPassword } from "../crypto/passwordHash.js";
import type { AuthService } from "../api/auth/auth.service.js";
import type { AuditLogService } from "./auditLog.service.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface WebAccountAuthDeps {
  prisma: PrismaClient;
  authService: AuthService;
  piiEncryptionKey: string;
  auditLog: AuditLogService;
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

    const tokenPair = await deps.authService.issueTokenPair({
      subjectType: "officer",
      officerId: account.officerId,
      role: account.officer.role,
    });

    return { ...tokenPair, mustChangePassword: account.mustChangePassword };
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

  return { login, changePassword, updateInfo, getMyAccount, listWebAccounts, resetPassword };
}

export type WebAccountAuthService = ReturnType<typeof createWebAccountAuthService>;
