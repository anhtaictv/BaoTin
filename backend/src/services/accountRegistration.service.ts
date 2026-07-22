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

  async function approveOfficer(adminOfficerId: string, officerId: string): Promise<void> {
    await deps.prisma.officer.update({ where: { id: officerId }, data: { approvalStatus: "approved" } });
    await deps.auditLog.record(adminOfficerId, "approve_officer", { type: "officer", id: officerId });
  }

  async function rejectOfficer(adminOfficerId: string, officerId: string): Promise<void> {
    await deps.prisma.officer.update({ where: { id: officerId }, data: { approvalStatus: "rejected" } });
    await deps.auditLog.record(adminOfficerId, "reject_officer", { type: "officer", id: officerId });
  }

  return {
    registerCitizen,
    loginCitizen,
    registerOfficer,
    loginOfficer,
    listPendingOfficers,
    approveOfficer,
    rejectOfficer,
  };
}

export type AccountRegistrationService = ReturnType<typeof createAccountRegistrationService>;
