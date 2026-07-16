import { z } from "zod";

export const webLoginSchema = z.object({
  username: z.string().min(1).max(20),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export const updateAccountInfoSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  unitName: z.string().max(200).optional(),
});

export const officerIdParamsSchema = z.object({
  officerId: z.string().uuid(),
});
