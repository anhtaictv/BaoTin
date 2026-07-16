import { z } from "zod";

/** Shared by GET /emergency-contacts and GET /area-alerts — both take the citizen's current
 * device GPS as plain query params (API_SPEC.md), not a request body. */
export const latLngQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
