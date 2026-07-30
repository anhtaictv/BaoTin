import { z } from "zod";
import { phoneNumberSchema } from "./auth.schema.js";

const usernameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]{4,32}$/, "Tên đăng nhập phải 4-32 ký tự, chỉ gồm chữ, số và dấu gạch dưới");

const passwordSchema = z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự");

/** Officer/admin-only — stricter than the shared passwordSchema above, which stays min-8
 * because it's also reachable from /auth/register/citizen and /auth/citizen/change-password
 * (citizens are OTP-first per docs/SECURITY.md §1.1, but this codebase already has a citizen
 * username/password path too — see registerCitizenSchema below — so tightening passwordSchema
 * in place would silently change citizen behavior). baomat.txt's hardening pass asks for
 * 12+ chars + complexity specifically for cán bộ/admin accounts. */
export const officerPasswordSchema = z
  .string()
  .min(12, "Mật khẩu phải có ít nhất 12 ký tự")
  .regex(/[a-z]/, "Mật khẩu phải chứa ít nhất 1 chữ thường")
  .regex(/[A-Z]/, "Mật khẩu phải chứa ít nhất 1 chữ hoa")
  .regex(/[0-9]/, "Mật khẩu phải chứa ít nhất 1 chữ số")
  .regex(/[^a-zA-Z0-9]/, "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt");

// Vietnamese CCCD is 12 digits; older CMND (still valid, not yet replaced for everyone) is 9.
const cccdNumberSchema = z.string().regex(/^\d{9}$|^\d{12}$/, "Số CCCD/CMND không hợp lệ");

const fullNameSchema = z.string().min(1, "Vui lòng nhập họ tên").max(200);
const addressSchema = z.string().min(1, "Vui lòng nhập địa chỉ").max(500);

export const loginPasswordSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

// multipart/form-data body — multer populates req.body with these text fields before the
// route handler runs, same as citizen/reports.routes.ts's createReportSchema.
export const registerCitizenSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  phoneNumber: phoneNumberSchema,
  cccdNumber: cccdNumberSchema,
  address: addressSchema,
});

export const registerOfficerSchema = z.object({
  username: usernameSchema,
  password: officerPasswordSchema,
  fullName: fullNameSchema,
  phoneNumber: phoneNumberSchema,
  cccdNumber: cccdNumberSchema,
  address: addressSchema,
});

export const officerIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const approveOfficerSchema = z.object({
  districtId: z.string().uuid(),
});

/** Citizen-only now (/auth/citizen/change-password) — kept at the shared min-8 passwordSchema.
 * Used to also back /auth/officer/change-password, but that route now uses
 * changeOfficerPasswordSchema below (officerPasswordSchema's 12+/complexity rule) instead, so
 * tightening officer passwords doesn't reach into the citizen flow. */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

/** Officer/admin-only — /auth/officer/change-password. See officerPasswordSchema's comment. */
export const changeOfficerPasswordSchema = z.object({
  oldPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại").max(200),
  newPassword: officerPasswordSchema,
});
