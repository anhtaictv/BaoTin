import { Router } from "express";
import type { AreaAlertsController } from "./areaAlerts.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { latLngQuerySchema } from "../../validation/schemas/location.schema.js";

/** API_SPEC.md — mounted at root "/area-alerts". */
export function createAreaAlertsRoutes(controller: AreaAlertsController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get(
    "/",
    requireAuth(["citizen"]),
    validateRequest(latLngQuerySchema, "query"),
    asyncHandler(controller.get),
  );

  return router;
}
