import { Router } from "express";
import type { CamerasController } from "./cameras.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { reportIdParamsSchema } from "../../validation/schemas/officer.schema.js";
import { createExtractionRequestSchema, nearbyCamerasQuerySchema } from "../../validation/schemas/camera.schema.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;

/** Mounted at the same base path as officerReports.routes.ts ("/officer/reports"). */
export function createCamerasRoutes(controller: CamerasController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get(
    "/:id/nearby-cameras",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(reportIdParamsSchema, "params"),
    validateRequest(nearbyCamerasQuerySchema, "query"),
    asyncHandler(controller.nearbyCameras),
  );

  router.post(
    "/:id/camera-extraction-requests",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(reportIdParamsSchema, "params"),
    validateRequest(createExtractionRequestSchema, "body"),
    asyncHandler(controller.createExtractionRequest),
  );

  router.get(
    "/:id/camera-extraction-requests",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(reportIdParamsSchema, "params"),
    asyncHandler(controller.listExtractionRequests),
  );

  return router;
}
