import { z } from "zod";

export const listChatMessagesQuerySchema = z
  .object({
    channel_type: z.enum(["general", "district"]),
    district_id: z.string().uuid().optional(),
    before: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine((v) => v.channel_type !== "district" || v.district_id, {
    message: "district_id là bắt buộc khi channel_type=district.",
    path: ["district_id"],
  });

export const sendChatMessageSchema = z
  .object({
    channelType: z.enum(["general", "district"]),
    districtId: z.string().uuid().optional(),
    content: z.string().trim().min(1).max(2000),
  })
  .refine((v) => v.channelType !== "district" || v.districtId, {
    message: "districtId là bắt buộc khi channelType=district.",
    path: ["districtId"],
  });
