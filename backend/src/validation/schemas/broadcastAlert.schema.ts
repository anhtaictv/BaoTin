import { z } from "zod";

export const createBroadcastAlertSchema = z.object({
  districtId: z.string().uuid(),
  message: z.string().min(1).max(500),
  urgency: z.enum(["emergency", "normal"]).optional(),
});
