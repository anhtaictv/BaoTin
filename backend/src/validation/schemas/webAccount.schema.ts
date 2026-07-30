import { z } from "zod";
import { officerPasswordSchema } from "./accountRegistration.schema.js";

export const webLoginSchema = z.object({
  username: z.string().min(1).max(20),
  password: z.string().min(1).max(200),
});

/** 2nd step of login for an account with totpEnabled — POST /auth/web/login/totp. challengeToken
 * is the opaque value login() returned instead of tokens (see webAccountAuth.service.ts). A
 * separate route+schema instead of folding totpCode into webLoginSchema: keeps the normal
 * password-only login request/response shape completely unchanged for every account that
 * doesn't have 2FA enabled (the vast majority), and keeps the two Zod schemas simple instead of
 * one schema with either/or optional fields. */
export const totpLoginSchema = z.object({
  challengeToken: z.string().min(1, "Thiếu challenge token"),
  code: z.string().regex(/^\d{6}$/, "Mã xác thực phải gồm 6 chữ số"),
});

/** dashboard-web-react's own account password change — always officer/admin, never shared
 * with any citizen route, so tightened in place to officerPasswordSchema (12+/complexity). */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(200),
  newPassword: officerPasswordSchema,
});

export const updateAccountInfoSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  unitName: z.string().max(200).optional(),
});

export const officerIdParamsSchema = z.object({
  officerId: z.string().uuid(),
});

export const totpConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Mã xác thực phải gồm 6 chữ số"),
});

export const totpDisableSchema = z.object({
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});
