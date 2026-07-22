import { Router } from "express";
import type { OfficerApprovalController } from "./officerApproval.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { approveOfficerSchema, officerIdParamsSchema } from "../../validation/schemas/accountRegistration.schema.js";

/** Admin-only — mounted at "/admin/officers". Approves/rejects officers created via the new
 * self-registration flow (registration.routes.ts's POST /auth/register/officer). */
export function createOfficerApprovalRoutes(controller: OfficerApprovalController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/pending", requireAuth(["admin"]), asyncHandler(controller.listPending));
  router.get("/districts", requireAuth(["admin"]), asyncHandler(controller.listDistricts));
  router.post(
    "/:id/approve",
    requireAuth(["admin"]),
    validateRequest(officerIdParamsSchema, "params"),
    validateRequest(approveOfficerSchema),
    asyncHandler(controller.approve),
  );
  router.post(
    "/:id/reject",
    requireAuth(["admin"]),
    validateRequest(officerIdParamsSchema, "params"),
    asyncHandler(controller.reject),
  );

  return router;
}
