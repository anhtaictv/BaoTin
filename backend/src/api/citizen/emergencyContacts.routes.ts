import { Router } from "express";
import type { EmergencyContactsController } from "./emergencyContacts.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { latLngQuerySchema } from "../../validation/schemas/location.schema.js";

/** API_SPEC.md — mounted at root "/emergency-contacts", not nested under /reports. */
export function createEmergencyContactsRoutes(controller: EmergencyContactsController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get(
    "/",
    requireAuth(["citizen"]),
    validateRequest(latLngQuerySchema, "query"),
    asyncHandler(controller.get),
  );

  return router;
}
