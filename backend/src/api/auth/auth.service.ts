import type { PrismaClient } from "@prisma/client";
import type { KeyLike } from "jose";
import { decryptField, encryptField } from "../../crypto/aesGcm.js";
import { hashPhoneNumber } from "../../crypto/phoneBlindIndex.js";
import { generateOtp, hashOtp, verifyOtp } from "../../crypto/otpHash.js";
import { signAccessToken } from "../../crypto/jwtKeys.js";
import { generateOpaqueToken, hashOpaqueToken } from "../../crypto/tokenHash.js";
import { HttpError } from "../../middleware/errorHandler.js";

const OTP_TTL_MINUTES = 5;

export interface AuthServiceDeps {
  prisma: PrismaClient;
  piiEncryptionKey: string;
  phoneBlindIndexKey: string;
  otpPepper: string;
  jwtPrivateKey: KeyLike;
  jwtAccessTtlMinutes: number;
  jwtRefreshTtlDays: number;
  /** Injectable so tests/dev don't need a real SMS provider wired up. Defaults to console log. */
  deliverOtp?: (phoneNumber: string, otp: string) => void;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInMinutes: number;
}

export function createAuthService(deps: AuthServiceDeps) {
  const deliverOtp =
    deps.deliverOtp ??
    ((phoneNumber: string, otp: string) => {
      // No real SMS/Zalo OA provider chosen yet (ROADMAP.md Giai đoạn 1) — this stub makes the
      // OTP observable for local dev/demo. Never log OTPs in a real deployment.
      // eslint-disable-next-line no-console
      console.log(`[otp-stub] would send OTP ${otp} to ${phoneNumber}`);
    });

  async function requestOtpForUser(phoneNumber: string): Promise<{ devOtp?: string }> {
    const phoneHash = hashPhoneNumber(phoneNumber, deps.phoneBlindIndexKey);

    const user = await deps.prisma.user.upsert({
      where: { phoneHash },
      update: {},
      create: { phoneHash, phoneNumberEnc: encryptField(phoneNumber, deps.piiEncryptionKey) },
    });

    return issueOtpChallenge({ subjectType: "user", userId: user.id }, phoneNumber);
  }

  async function issueOtpChallenge(
    subject: { subjectType: "user" | "officer"; userId?: string; officerId?: string },
    phoneNumber: string,
  ): Promise<{ devOtp?: string }> {
    const otp = generateOtp();
    const codeHash = hashOtp(otp, deps.otpPepper);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await deps.prisma.otpChallenge.create({
      data: {
        subjectType: subject.subjectType,
        userId: subject.userId,
        officerId: subject.officerId,
        codeHash,
        expiresAt,
      },
    });

    deliverOtp(phoneNumber, otp);

    // Dev/demo convenience only — never expose the OTP in a response outside development.
    return { devOtp: process.env.NODE_ENV !== "production" ? otp : undefined };
  }

  async function verifyOtpForUser(phoneNumber: string, otp: string): Promise<TokenPair> {
    const phoneHash = hashPhoneNumber(phoneNumber, deps.phoneBlindIndexKey);
    const user = await deps.prisma.user.findUnique({ where: { phoneHash } });
    if (!user) throw new HttpError(401, "INVALID_OTP", "Mã OTP không đúng hoặc đã hết hạn.");

    const challenge = await deps.prisma.otpChallenge.findFirst({
      where: { subjectType: "user", userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) throw new HttpError(401, "INVALID_OTP", "Mã OTP không đúng hoặc đã hết hạn.");

    if (challenge.attemptCount >= 5) {
      throw new HttpError(429, "OTP_LOCKED", "Đã nhập sai quá nhiều lần, yêu cầu OTP mới.");
    }

    const ok = verifyOtp(otp, challenge.codeHash, deps.otpPepper);
    if (!ok) {
      await deps.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new HttpError(401, "INVALID_OTP", "Mã OTP không đúng hoặc đã hết hạn.");
    }

    await deps.prisma.$transaction([
      deps.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
      deps.prisma.user.update({
        where: { id: user.id },
        data: user.verifiedAt ? {} : { verifiedAt: new Date() },
      }),
    ]);

    return issueTokenPair({ subjectType: "user", userId: user.id, role: "citizen" });
  }

  /**
   * Single endpoint, two modes, matching API_SPEC.md's one-route shape for officer login
   * while keeping the OTP-first model from SECURITY.md §1.1 (no password field on Officer):
   *  - {phoneNumber} only  -> looks up an *existing* officer (never auto-creates, admin-provisioned
   *    per ARCHITECTURE.md) and issues an OTP challenge.
   *  - {phoneNumber, otp}  -> verifies it and issues an officer token pair.
   * See docs/adr note in this file's history / PLAN for the rationale if this needs revisiting.
   */
  async function officerLogin(phoneNumber: string, otp?: string): Promise<{ devOtp?: string } | TokenPair> {
    const phoneHash = hashPhoneNumber(phoneNumber, deps.phoneBlindIndexKey);
    const officer = await deps.prisma.officer.findUnique({ where: { phoneHash } });
    // Generic error regardless of whether the phone exists — avoids leaking which numbers
    // are provisioned as officer accounts.
    if (!officer) throw new HttpError(401, "INVALID_CREDENTIALS", "Không thể đăng nhập với số điện thoại này.");

    if (!otp) {
      return issueOtpChallenge({ subjectType: "officer", officerId: officer.id }, phoneNumber);
    }

    const challenge = await deps.prisma.otpChallenge.findFirst({
      where: { subjectType: "officer", officerId: officer.id, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) throw new HttpError(401, "INVALID_OTP", "Mã OTP không đúng hoặc đã hết hạn.");
    if (challenge.attemptCount >= 5) {
      throw new HttpError(429, "OTP_LOCKED", "Đã nhập sai quá nhiều lần, yêu cầu OTP mới.");
    }

    const ok = verifyOtp(otp, challenge.codeHash, deps.otpPepper);
    if (!ok) {
      await deps.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new HttpError(401, "INVALID_OTP", "Mã OTP không đúng hoặc đã hết hạn.");
    }
    await deps.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

    return issueTokenPair({ subjectType: "officer", officerId: officer.id, role: officer.role });
  }

  async function issueTokenPair(subject: {
    subjectType: "user" | "officer";
    userId?: string;
    officerId?: string;
    role: string;
  }): Promise<TokenPair> {
    const sub = subject.userId ?? subject.officerId;
    if (!sub) throw new Error("issueTokenPair requires userId or officerId");

    const accessToken = await signAccessToken(
      { sub, role: subject.role, subjectType: subject.subjectType },
      deps.jwtPrivateKey,
      deps.jwtAccessTtlMinutes,
    );

    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + deps.jwtRefreshTtlDays * 24 * 60 * 60 * 1000);
    await deps.prisma.refreshToken.create({
      data: {
        tokenHash: hashOpaqueToken(refreshToken),
        subjectType: subject.subjectType,
        userId: subject.userId,
        officerId: subject.officerId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresInMinutes: deps.jwtAccessTtlMinutes };
  }

  /** Rotates a refresh token: the old one is invalidated the instant a new one is issued. */
  async function rotateRefreshToken(presentedToken: string): Promise<TokenPair> {
    const tokenHash = hashOpaqueToken(presentedToken);
    const existing = await deps.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }

    const role = existing.subjectType === "officer" ? await officerRole(existing.officerId!) : "citizen";

    const next = await issueTokenPair({
      subjectType: existing.subjectType as "user" | "officer",
      userId: existing.userId ?? undefined,
      officerId: existing.officerId ?? undefined,
      role,
    });

    await deps.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return next;
  }

  async function officerRole(officerId: string): Promise<string> {
    const officer = await deps.prisma.officer.findUniqueOrThrow({ where: { id: officerId } });
    return officer.role;
  }

  /** "Logout everywhere" — SECURITY.md §1.3. Revokes every active refresh token for the subject. */
  async function revokeAllSessions(subjectType: "user" | "officer", subjectId: string): Promise<void> {
    const where = subjectType === "user" ? { userId: subjectId } : { officerId: subjectId };
    await deps.prisma.refreshToken.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Decrypts a user's/officer's stored phone number — used by senior/admin-only views. */
  function decryptPhoneNumber(encrypted: string): string {
    return decryptField(encrypted, deps.piiEncryptionKey);
  }

  return {
    requestOtpForUser,
    verifyOtpForUser,
    officerLogin,
    rotateRefreshToken,
    revokeAllSessions,
    decryptPhoneNumber,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
