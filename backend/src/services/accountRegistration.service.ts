import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import { encryptField, decryptField } from "../crypto/aesGcm.js";
import { hashPhoneNumber } from "../crypto/phoneBlindIndex.js";
import { hashPassword, verifyPassword } from "../crypto/passwordHash.js";
import { validateImageBuffer } from "../api/citizen/imageValidation.js";
import type { StorageClient } from "../storage/minioClient.js";
import type { AuthService, TokenPair } from "../api/auth/auth.service.js";
import type { AuditLogService } from "./auditLog.service.js";
import { upsertWholeDistrictAssignment } from "../db/officerDistrictAssignment.js";

export interface AccountRegistrationDeps {
  prisma: PrismaClient;
  piiEncryptionKey: string;
  phoneBlindIndexKey: string;
  authService: AuthService;
  storage: StorageClient;
  auditLog: AuditLogService;
}

interface PersonalInfoInput {
  username: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  cccdNumber: string;
  address: string;
}

export interface RegisterCitizenInput extends PersonalInfoInput {
  cccdFront: { buffer: Buffer; mimetype: string };
  cccdBack: { buffer: Buffer; mimetype: string };
}

export interface PendingOfficerSummary {
  id: string;
  username: string;
  fullName: string;
  phoneNumber: string;
  cccdNumber: string;
  address: string;
  createdAt: Date;
}

export interface LockedCitizenSummary {
  id: string;
  username: string | null;
  fullName: string | null;
  phoneNumber: string;
  lockedAt: Date;
  falseReportCount: number;
}

/**
 * Username/password registration+login — a NEW path that sits *alongside* the OTP flow
 * (auth.service.ts) rather than replacing it, per product decision. Citizens register and
 * are active immediately (no human review of the CCCD photos in this phase — CLAUDE.md's
 * human-in-the-loop principle governs *report verification*, not account creation).
 * Officers self-register but stay locked out (approvalStatus "pending") until an admin
 * approves them — see officerApproval endpoints below, mirroring SECURITY.md §1.4's
 * audit-log requirement for sensitive admin actions.
 */
export function createAccountRegistrationService(deps: AccountRegistrationDeps) {
  async function assertUsernameFree(username: string, table: "user" | "officer") {
    const existing =
      table === "user"
        ? await deps.prisma.user.findUnique({ where: { username } })
        : await deps.prisma.officer.findUnique({ where: { username } });
    if (existing) throw new HttpError(409, "USERNAME_TAKEN", "Tên đăng nhập đã được sử dụng.");
  }

  async function registerCitizen(input: RegisterCitizenInput): Promise<TokenPair> {
    const frontValidation = await validateImageBuffer(input.cccdFront.buffer);
    if (!frontValidation.valid) {
      throw new HttpError(400, "INVALID_IMAGE", frontValidation.reason ?? "Ảnh CCCD mặt trước không hợp lệ.");
    }
    const backValidation = await validateImageBuffer(input.cccdBack.buffer);
    if (!backValidation.valid) {
      throw new HttpError(400, "INVALID_IMAGE", backValidation.reason ?? "Ảnh CCCD mặt sau không hợp lệ.");
    }

    const phoneHash = hashPhoneNumber(input.phoneNumber, deps.phoneBlindIndexKey);
    const existing = await deps.prisma.user.findUnique({ where: { phoneHash } });
    if (existing?.username) {
      throw new HttpError(409, "PHONE_ALREADY_REGISTERED", "Số điện thoại này đã đăng ký tài khoản.");
    }
    await assertUsernameFree(input.username, "user");

    const photoGroupId = randomUUID();
    const cccdFrontPhotoUrl = `cccd-photos/${photoGroupId}/front`;
    const cccdBackPhotoUrl = `cccd-photos/${photoGroupId}/back`;
    await deps.storage.putObject(cccdFrontPhotoUrl, input.cccdFront.buffer, input.cccdFront.mimetype);
    await deps.storage.putObject(cccdBackPhotoUrl, input.cccdBack.buffer, input.cccdBack.mimetype);

    const passwordHash = await hashPassword(input.password);
    const data = {
      username: input.username,
      passwordHash,
      fullNameEnc: encryptField(input.fullName, deps.piiEncryptionKey),
      cccdNumberEnc: encryptField(input.cccdNumber, deps.piiEncryptionKey),
      addressEnc: encryptField(input.address, deps.piiEncryptionKey),
      cccdFrontPhotoUrl,
      cccdBackPhotoUrl,
    };

    const user = existing
      ? await deps.prisma.user.update({ where: { id: existing.id }, data })
      : await deps.prisma.user.create({
          data: {
            ...data,
            phoneHash,
            phoneNumberEnc: encryptField(input.phoneNumber, deps.piiEncryptionKey),
          },
        });

    return deps.authService.issueTokenPair({ subjectType: "user", userId: user.id, role: "citizen" });
  }

  async function loginCitizen(username: string, password: string): Promise<TokenPair> {
    const user = await deps.prisma.user.findUnique({ where: { username } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu.");
    }
    return deps.authService.issueTokenPair({ subjectType: "user", userId: user.id, role: "citizen" });
  }

  /** Self-service — same shape as changeOfficerPassword below, targeting users.password_hash
   * instead. Deliberately doesn't check lockedAt: a citizen auto-locked for repeated false
   * reports (officerReports.service.ts) can still manage their own account, the lock only
   * blocks new normal report submissions (reportLifecycle.service.ts). */
  async function changeCitizenPassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await deps.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new HttpError(409, "NO_PASSWORD_SET", "Tài khoản chưa có mật khẩu đăng nhập (chỉ dùng OTP).");
    }
    if (!(await verifyPassword(oldPassword, user.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Mật khẩu hiện tại không đúng.");
    }
    await deps.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  }

  async function registerOfficer(input: PersonalInfoInput): Promise<{ pending: true }> {
    const phoneHash = hashPhoneNumber(input.phoneNumber, deps.phoneBlindIndexKey);
    const existing = await deps.prisma.officer.findUnique({ where: { phoneHash } });
    if (existing) {
      throw new HttpError(
        409,
        "PHONE_ALREADY_REGISTERED",
        "Số điện thoại này đã có tài khoản cán bộ. Vui lòng đăng nhập bằng OTP hoặc liên hệ quản trị viên.",
      );
    }
    await assertUsernameFree(input.username, "officer");

    await deps.prisma.officer.create({
      data: {
        phoneHash,
        phoneNumberEnc: encryptField(input.phoneNumber, deps.piiEncryptionKey),
        fullNameEnc: encryptField(input.fullName, deps.piiEncryptionKey),
        username: input.username,
        passwordHash: await hashPassword(input.password),
        cccdNumberEnc: encryptField(input.cccdNumber, deps.piiEncryptionKey),
        addressEnc: encryptField(input.address, deps.piiEncryptionKey),
        role: "officer",
        approvalStatus: "pending",
      },
    });

    return { pending: true };
  }

  async function loginOfficer(username: string, password: string): Promise<TokenPair> {
    const officer = await deps.prisma.officer.findUnique({ where: { username } });
    if (!officer?.passwordHash || !(await verifyPassword(password, officer.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu.");
    }
    if (officer.approvalStatus === "pending") {
      throw new HttpError(403, "APPROVAL_PENDING", "Tài khoản đang chờ quản trị viên duyệt.");
    }
    if (officer.approvalStatus === "rejected") {
      throw new HttpError(403, "APPROVAL_REJECTED", "Tài khoản đã bị từ chối. Vui lòng liên hệ quản trị viên.");
    }
    return deps.authService.issueTokenPair({ subjectType: "officer", officerId: officer.id, role: officer.role });
  }

  /** Self-service, any role (not admin-only) — a regular officer needs this exactly as much
   * as an admin. officerId comes from the authenticated JWT, never the request body, so an
   * officer can only ever change their own password. */
  async function changeOfficerPassword(officerId: string, oldPassword: string, newPassword: string): Promise<void> {
    const officer = await deps.prisma.officer.findUnique({ where: { id: officerId } });
    if (!officer?.passwordHash) {
      throw new HttpError(409, "NO_PASSWORD_SET", "Tài khoản chưa có mật khẩu đăng nhập (chỉ dùng OTP).");
    }
    if (!(await verifyPassword(oldPassword, officer.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Mật khẩu hiện tại không đúng.");
    }
    await deps.prisma.officer.update({
      where: { id: officerId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  }

  /** Admin-only — viewing pending officers' decrypted PII is exactly the kind of "thao tác
   * nhạy cảm" SECURITY.md §1.4 requires an audit trail for, same rationale as
   * webAccountAuth.service.ts's listWebAccounts. */
  async function listPendingOfficers(adminOfficerId: string): Promise<PendingOfficerSummary[]> {
    await deps.auditLog.record(adminOfficerId, "view_pending_officers");

    const rows = await deps.prisma.officer.findMany({
      where: { approvalStatus: "pending" },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => ({
      id: row.id,
      username: row.username ?? "",
      fullName: decryptField(row.fullNameEnc, deps.piiEncryptionKey),
      phoneNumber: decryptField(row.phoneNumberEnc, deps.piiEncryptionKey),
      cccdNumber: row.cccdNumberEnc ? decryptField(row.cccdNumberEnc, deps.piiEncryptionKey) : "",
      address: row.addressEnc ? decryptField(row.addressEnc, deps.piiEncryptionKey) : "",
      createdAt: row.createdAt,
    }));
  }

  /** The list an admin picks a `districtId` from when approving — same shape geo-matching
   * keys off (District.tenXa), cheap enough (102 rows) to return unpaginated. */
  async function listDistrictsForAssignment(): Promise<{ id: string; tenXa: string }[]> {
    return deps.prisma.district.findMany({ select: { id: true, tenXa: true }, orderBy: { tenXa: "asc" } });
  }

  /** A self-registered officer starts with zero district assignments — without one, they
   * can never be geo-matched to a report or see anything in their "Tin báo" list even after
   * approval (found via a real production report that got silently routed to a different,
   * already-assigned officer instead). So approval now REQUIRES picking the ward the officer
   * is responsible for, same table/pattern seed-officers.ts uses for admin-provisioned ones. */
  async function approveOfficer(adminOfficerId: string, officerId: string, districtId: string): Promise<void> {
    const district = await deps.prisma.district.findUnique({ where: { id: districtId } });
    if (!district) throw new HttpError(404, "DISTRICT_NOT_FOUND", "Không tìm thấy địa bàn.");

    await deps.prisma.officer.update({ where: { id: officerId }, data: { approvalStatus: "approved" } });
    await upsertWholeDistrictAssignment(deps.prisma, officerId, districtId);
    await deps.auditLog.record(adminOfficerId, "approve_officer", { type: "officer", id: officerId }, { districtId });
  }

  /** Admin-only — promotes/demotes an officer's role tier (vd. nâng lên commune_head =
   * "trưởng xã" để họ được phân địa bàn con cho cấp dưới qua communeAssignment.service.ts).
   * Deliberately separate from approveOfficer: role changes can happen anytime, not just at
   * first approval. */
  async function setOfficerRole(
    adminOfficerId: string,
    officerId: string,
    role: "officer" | "senior_officer" | "commune_head" | "admin",
  ): Promise<void> {
    const officer = await deps.prisma.officer.findUnique({ where: { id: officerId } });
    if (!officer) throw new HttpError(404, "OFFICER_NOT_FOUND", "Không tìm thấy tài khoản cán bộ.");

    await deps.prisma.officer.update({ where: { id: officerId }, data: { role } });
    await deps.auditLog.record(adminOfficerId, "set_officer_role", { type: "officer", id: officerId }, { role });
  }

  async function rejectOfficer(adminOfficerId: string, officerId: string): Promise<void> {
    await deps.prisma.officer.update({ where: { id: officerId }, data: { approvalStatus: "rejected" } });
    await deps.auditLog.record(adminOfficerId, "reject_officer", { type: "officer", id: officerId });
  }

  /** Admin-only — same audit-log-the-view rationale as listPendingOfficers. Locked by
   * officerReports.service.ts's lockIfRepeatedlyFalse (4th confirmed_false report); this is
   * the only way to find *which* accounts got auto-locked, since there's no notification for
   * it beyond the audit log. falseReportCount is a live recount, not a stored snapshot — it
   * only ever grows (nothing un-confirms a report), so it's always >= the 4 that triggered
   * the lock. */
  async function listLockedCitizens(adminOfficerId: string): Promise<LockedCitizenSummary[]> {
    await deps.auditLog.record(adminOfficerId, "view_locked_citizens");

    const rows = await deps.prisma.user.findMany({
      where: { lockedAt: { not: null } },
      orderBy: { lockedAt: "desc" },
    });
    if (rows.length === 0) return [];

    const falseCounts = await deps.prisma.report.groupBy({
      by: ["userId"],
      where: { userId: { in: rows.map((r) => r.id) }, source: "citizen", status: "confirmed_false" },
      _count: true,
    });
    const falseCountByUserId = new Map(falseCounts.map((c) => [c.userId, c._count]));

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.fullNameEnc ? decryptField(row.fullNameEnc, deps.piiEncryptionKey) : null,
      phoneNumber: decryptField(row.phoneNumberEnc, deps.piiEncryptionKey),
      lockedAt: row.lockedAt!,
      falseReportCount: falseCountByUserId.get(row.id) ?? 0,
    }));
  }

  async function unlockCitizen(adminOfficerId: string, userId: string): Promise<void> {
    const user = await deps.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");

    await deps.prisma.user.update({ where: { id: userId }, data: { lockedAt: null } });
    await deps.auditLog.record(adminOfficerId, "unlock_citizen", { type: "user", id: userId });
  }

  return {
    registerCitizen,
    loginCitizen,
    changeCitizenPassword,
    registerOfficer,
    loginOfficer,
    changeOfficerPassword,
    listPendingOfficers,
    listDistrictsForAssignment,
    approveOfficer,
    rejectOfficer,
    setOfficerRole,
    listLockedCitizens,
    unlockCitizen,
  };
}

export type AccountRegistrationService = ReturnType<typeof createAccountRegistrationService>;
