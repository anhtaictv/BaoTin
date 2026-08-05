import { Router } from "express";
import type { BroadcastAlertsController } from "./broadcastAlerts.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { broadcastAlertLimiter } from "../../middleware/rateLimiters.js";
import { createBroadcastAlertSchema } from "../../validation/schemas/broadcastAlert.schema.js";

const SEND_ROLES = ["officer", "senior_officer", "admin"] as const;

/** Geo-fence alert (cảnh báo ngược từ cán bộ) — mounted at "/officer/broadcast-alerts". A
 * regular officer can only target a district they're assigned to (enforced in
 * broadcastAlerts.service.ts via districtScope, not here). */
export function createBroadcastAlertsRoutes(controller: BroadcastAlertsController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/districts", requireAuth([...SEND_ROLES]), asyncHandler(controller.listDistricts));

  router.post(
    "/",
    broadcastAlertLimiter,
    requireAuth([...SEND_ROLES]),
    validateRequest(createBroadcastAlertSchema),
    asyncHandler(controller.create),
  );

  return router;
}
