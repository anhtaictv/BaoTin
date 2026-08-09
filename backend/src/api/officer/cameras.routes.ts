import { Router } from "express";
import type { CamerasController } from "./cameras.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { reportIdParamsSchema } from "../../validation/schemas/officer.schema.js";
import {
  cameraIdParamsSchema,
  cameraInputSchema,
  createExtractionRequestSchema,
  nearbyCamerasQuerySchema,
} from "../../validation/schemas/camera.schema.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;
/** Registering/editing a real camera is an administrative action, not something every
 * officer does — restricted to the same roles that already bypass district scoping. */
const CAMERA_MANAGE_ROLES = ["admin", "senior_officer"] as const;

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

/** Standalone "Camera" page (not tied to any one report) — mounted at its own base path
 * "/officer/cameras" in app.ts, separate from createCamerasRoutes above which shares
 * officerReportsRouter's "/officer/reports/:id" base. */
export function createDistrictCamerasRoutes(controller: CamerasController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/", requireAuth([...OFFICER_ROLES]), asyncHandler(controller.listDistrictCameras));

  router.post(
    "/",
    requireAuth([...CAMERA_MANAGE_ROLES]),
    validateRequest(cameraInputSchema, "body"),
    asyncHandler(controller.createCamera),
  );

  router.put(
    "/:id",
    requireAuth([...CAMERA_MANAGE_ROLES]),
    validateRequest(cameraIdParamsSchema, "params"),
    validateRequest(cameraInputSchema, "body"),
    asyncHandler(controller.updateCamera),
  );

  router.delete(
    "/:id",
    requireAuth([...CAMERA_MANAGE_ROLES]),
    validateRequest(cameraIdParamsSchema, "params"),
    asyncHandler(controller.deleteCamera),
  );

  return router;
}
