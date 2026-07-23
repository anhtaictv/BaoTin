import { Router } from "express";
import type { TrafficAccidentsController } from "../detections/trafficAccidents.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  listTrafficAccidentAlertsQuerySchema,
  trafficAccidentAlertIdParamsSchema,
} from "../../validation/schemas/trafficAccidentAlert.schema.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;

/** Mounted at "/officer/traffic-accident-alerts". */
export function createTrafficAccidentAlertsRoutes(
  controller: TrafficAccidentsController,
  requireAuth: RequireAuth,
): Router {
  const router = Router();

  router.get(
    "/",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(listTrafficAccidentAlertsQuerySchema, "query"),
    asyncHandler(controller.list),
  );

  router.get(
    "/:id",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(trafficAccidentAlertIdParamsSchema, "params"),
    asyncHandler(controller.detail),
  );

  router.post(
    "/:id/confirm",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(trafficAccidentAlertIdParamsSchema, "params"),
    asyncHandler(controller.confirm),
  );

  router.post(
    "/:id/dismiss",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(trafficAccidentAlertIdParamsSchema, "params"),
    asyncHandler(controller.dismiss),
  );

  return router;
}
