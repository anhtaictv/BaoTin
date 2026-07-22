import { z } from "zod";

// Vietnamese mobile numbers: 0 + 9 digits (matches DATABASE_SCHEMA.md phone_number VARCHAR(15)).
// Exported for reuse by accountRegistration.schema.ts's username/password registration forms.
export const phoneNumberSchema = z
  .string()
  .regex(/^0\d{9}$/, "Số điện thoại phải gồm 10 số, bắt đầu bằng 0");

export const otpRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export const otpVerifySchema = z.object({
  phoneNumber: phoneNumberSchema,
  otp: z.string().regex(/^\d{6}$/, "OTP phải gồm 6 số"),
});

export const officerLoginSchema = z.object({
  phoneNumber: phoneNumberSchema,
  otp: z.string().regex(/^\d{6}$/).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
