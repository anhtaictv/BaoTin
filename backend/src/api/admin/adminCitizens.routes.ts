import { Router } from "express";
import type { AdminCitizensController } from "./adminCitizens.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { officerIdParamsSchema } from "../../validation/schemas/accountRegistration.schema.js";

/** Admin-only — mounted at "/admin/citizens". Unlocks citizen accounts auto-locked by
 * officerReports.service.ts's lockIfRepeatedlyFalse. officerIdParamsSchema is just
 * `{id: uuid()}` — reused as-is, it isn't actually officer-specific. */
export function createAdminCitizensRoutes(controller: AdminCitizensController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/locked", requireAuth(["admin"]), asyncHandler(controller.listLocked));
  router.post(
    "/:id/unlock",
    requireAuth(["admin"]),
    validateRequest(officerIdParamsSchema, "params"),
    asyncHandler(controller.unlock),
  );

  return router;
}
