import { z } from "zod";

export const dashboardOverviewQuerySchema = z.object({
  district_id: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const dashboardDaysQuerySchema = z.object({
  district_id: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});
