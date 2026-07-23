import { z } from "zod";

export const listTrafficAccidentAlertsQuerySchema = z.object({
  district_id: z.string().uuid().optional(),
  status: z.enum(["pending", "confirmed", "dismissed"]).optional(),
});

export const trafficAccidentAlertIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/** multipart/form-data body — multer populates req.body with these text fields before the
 * route handler runs, same convention as accountRegistration.schema.ts. */
export const ingestTrafficAccidentSchema = z.object({
  cameraId: z.string().uuid(),
  plateNumbers: z.string().max(500).optional(),
  detectedAt: z.coerce.date().optional(),
});
