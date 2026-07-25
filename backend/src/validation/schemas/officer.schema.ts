import { z } from "zod";

export const listOfficerReportsQuerySchema = z.object({
  district_id: z.string().uuid().optional(),
  status: z.enum(["pending", "verifying", "confirmed_true", "confirmed_false"]).optional(),
  urgency: z.enum(["emergency", "normal"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
});

export const reportIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// 'pending' is deliberately excluded — that's the initial state only, never something an
// officer chooses to set a report *back* to.
export const updateReportStatusSchema = z.object({
  status: z.enum(["verifying", "confirmed_true", "confirmed_false"]),
  note: z.string().max(2000).optional(),
});
