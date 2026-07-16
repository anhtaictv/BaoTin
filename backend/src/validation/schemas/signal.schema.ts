import { z } from "zod";

export const listSignalsQuerySchema = z.object({
  district_id: z.string().uuid().optional(),
  trust_level: z.enum(["verified_press", "unverified_social"]).optional(),
  category: z.string().max(100).optional(),
});

export const signalIdParamsSchema = z.object({
  id: z.string().uuid(),
});
