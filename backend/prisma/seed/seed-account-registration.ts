import sharp from "sharp";
import type { PrismaClient } from "@prisma/client";
import type { StorageClient } from "../../src/storage/minioClient.js";
import { createAccountRegistrationService } from "../../src/services/accountRegistration.service.js";
import { createAuthService } from "../../src/api/auth/auth.service.js";
import { createAuditLogService } from "../../src/services/auditLog.service.js";
import { loadJwtKeys } from "../../src/crypto/jwtKeys.js";
import { hashPhoneNumber } from "../../src/crypto/phoneBlindIndex.js";

export interface SeedAccountRegistrationDeps {
  prisma: PrismaClient;
  piiEncryptionKey: string;
  phoneBlindIndexKey: string;
  otpPepper: string;
  storage: StorageClient;
  jwtPrivateKeyPem: string;
  jwtPublicKeyPem: string;
}

const DEMO_PASSWORD = "Demo@12345";

/** A 1x1 placeholder JPEG — good enough to pass validateImageBuffer's format check; these
 * demo rows exist to exercise the login/approval flow, not to look like a real CCCD. */
async function placeholderCccdPhoto(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 200, b: 200 } } })
    .jpeg()
    .toBuffer();
}

/**
 * Demo accounts for the username/password registration flow (auth/registration.routes.ts),
 * separate from seed-officers.ts's OTP-only roster — [DEMO] prefix + obviously-fake data,
 * same convention as the rest of prisma/seed. Fixed password `Demo@12345` for all three so
 * graders/testers don't need to hunt through logs (unlike seed-web-accounts.ts's
 * one-time-random temp passwords, which exist for a *provisioned* account model, not this
 * self-registration one).
 */
export async function seedAccountRegistrationDemo(deps: SeedAccountRegistrationDeps): Promise<void> {
  const { privateKey } = await loadJwtKeys(deps.jwtPrivateKeyPem, deps.jwtPublicKeyPem);
  const authService = createAuthService({
    prisma: deps.prisma,
    piiEncryptionKey: deps.piiEncryptionKey,
    phoneBlindIndexKey: deps.phoneBlindIndexKey,
    otpPepper: deps.otpPepper,
    jwtPrivateKey: privateKey,
    jwtAccessTtlMinutes: 20,
    jwtRefreshTtlDays: 30,
  });
  const auditLog = createAuditLogService(deps.prisma);
  const service = createAccountRegistrationService({
    prisma: deps.prisma,
    piiEncryptionKey: deps.piiEncryptionKey,
    phoneBlindIndexKey: deps.phoneBlindIndexKey,
    authService,
    storage: deps.storage,
    auditLog,
  });

  const photo = await placeholderCccdPhoto();
  // seed-officers.ts's [DEMO] admin (0900000099) — used as the approving admin below so the
  // audit log row points at a real, meaningful account instead of a self-approval.
  const adminPhoneHash = hashPhoneNumber("0900000099", deps.phoneBlindIndexKey);
  const adminOfficer = await deps.prisma.officer.findUnique({ where: { phoneHash: adminPhoneHash } });

  try {
    await service.registerCitizen({
      username: "demo_citizen",
      password: DEMO_PASSWORD,
      fullName: "[DEMO] Công dân đăng ký",
      phoneNumber: "0900000091",
      cccdNumber: "064099000091",
      address: "[DEMO] 12 Nguyễn Tất Thành, Buôn Ma Thuột",
      cccdFront: { buffer: photo, mimetype: "image/jpeg" },
      cccdBack: { buffer: photo, mimetype: "image/jpeg" },
    });
    console.log("[seed-account-registration] demo_citizen (approved, ready to log in)");
  } catch (err: any) {
    if (err?.code !== "PHONE_ALREADY_REGISTERED" && err?.code !== "USERNAME_TAKEN") throw err;
    console.log("[seed-account-registration] demo_citizen already exists — skipping");
  }

  try {
    await service.registerOfficer({
      username: "demo_officer_approved",
      password: DEMO_PASSWORD,
      fullName: "[DEMO] Cán bộ đã duyệt",
      phoneNumber: "0900000092",
      cccdNumber: "064099000092",
      address: "[DEMO] 34 Y Jút, Buôn Ma Thuột",
    });
    const officer = await deps.prisma.officer.findUnique({ where: { username: "demo_officer_approved" } });
    if (officer) await service.approveOfficer(adminOfficer?.id ?? officer.id, officer.id);
    console.log("[seed-account-registration] demo_officer_approved (approved, ready to log in)");
  } catch (err: any) {
    if (err?.code !== "PHONE_ALREADY_REGISTERED" && err?.code !== "USERNAME_TAKEN") throw err;
    console.log("[seed-account-registration] demo_officer_approved already exists — skipping");
  }

  try {
    await service.registerOfficer({
      username: "demo_officer_pending",
      password: DEMO_PASSWORD,
      fullName: "[DEMO] Cán bộ chờ duyệt",
      phoneNumber: "0900000093",
      cccdNumber: "064099000093",
      address: "[DEMO] 56 Phan Chu Trinh, Buôn Ma Thuột",
    });
    console.log("[seed-account-registration] demo_officer_pending (pending admin approval)");
  } catch (err: any) {
    if (err?.code !== "PHONE_ALREADY_REGISTERED" && err?.code !== "USERNAME_TAKEN") throw err;
    console.log("[seed-account-registration] demo_officer_pending already exists — skipping");
  }

  console.log(`[seed-account-registration] password for all 3 demo accounts: ${DEMO_PASSWORD}`);
}
