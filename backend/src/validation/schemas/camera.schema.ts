import { z } from "zod";

/** Capped at 5km — this is "nearby", not a general camera search (CLAUDE.md #8 scope). */
export const nearbyCamerasQuerySchema = z.object({
  radius_m: z.coerce.number().int().positive().max(5000).optional(),
});

/** `cameraIds` supports selecting several cameras along a route in one action (e.g. tracing
 * a vehicle's likely path after an accident) — each still becomes its own independent
 * administrative request to that camera's managing unit (see CameraExtractionRequest.groupId
 * in schema.prisma). Capped at 10 — an administrative paperwork batch, not a network-wide
 * canvass. */
export const createExtractionRequestSchema = z
  .object({
    cameraIds: z.array(z.string().uuid()).min(1).max(10),
    timeRangeStart: z.coerce.date(),
    timeRangeEnd: z.coerce.date(),
    note: z.string().max(2000).optional(),
  })
  .refine((data) => data.timeRangeEnd > data.timeRangeStart, {
    message: "Thời điểm kết thúc phải sau thời điểm bắt đầu.",
    path: ["timeRangeEnd"],
  });
