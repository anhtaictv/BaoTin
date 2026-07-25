import { z } from "zod";
import { phoneNumberSchema } from "./auth.schema.js";

const usernameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]{4,32}$/, "Tên đăng nhập phải 4-32 ký tự, chỉ gồm chữ, số và dấu gạch dưới");

const passwordSchema = z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự");

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
  password: passwordSchema,
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

/** Same shape as webAccount.schema.ts's changePasswordSchema — shared by both
 * /auth/officer/change-password and /auth/citizen/change-password, which each verify against
 * their own row's password_hash (officers.password_hash / users.password_hash respectively,
 * separate mechanisms from WebAccount's dashboard-web-react accounts). */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
