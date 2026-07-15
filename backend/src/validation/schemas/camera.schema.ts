import { z } from "zod";

/** Capped at 5km — this is "nearby", not a general camera search (CLAUDE.md #8 scope). */
export const nearbyCamerasQuerySchema = z.object({
  radius_m: z.coerce.number().int().positive().max(5000).optional(),
});

export const createExtractionRequestSchema = z
  .object({
    cameraId: z.string().uuid(),
    timeRangeStart: z.coerce.date(),
    timeRangeEnd: z.coerce.date(),
    note: z.string().max(2000).optional(),
  })
  .refine((data) => data.timeRangeEnd > data.timeRangeStart, {
    message: "Thời điểm kết thúc phải sau thời điểm bắt đầu.",
    path: ["timeRangeEnd"],
  });
