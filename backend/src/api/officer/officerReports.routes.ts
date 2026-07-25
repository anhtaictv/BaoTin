import { Router } from "express";
import type { OfficerReportsController } from "./officerReports.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  listOfficerReportsQuerySchema,
  reportIdParamsSchema,
  updateReportStatusSchema,
} from "../../validation/schemas/officer.schema.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;

export function createOfficerReportsRoutes(controller: OfficerReportsController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get(
    "/",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(listOfficerReportsQuerySchema, "query"),
    asyncHandler(controller.list),
  );

  // Must be registered before "/:id" — otherwise Express would match "overview-stats" as
  // the :id param and 400 on the uuid() validation instead of hitting this handler.
  router.get(
    "/overview-stats",
    requireAuth([...OFFICER_ROLES]),
    asyncHandler(controller.overviewStats),
  );

  router.get(
    "/:id",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(reportIdParamsSchema, "params"),
    asyncHandler(controller.detail),
  );

  router.patch(
    "/:id/status",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(reportIdParamsSchema, "params"),
    validateRequest(updateReportStatusSchema, "body"),
    asyncHandler(controller.updateStatus),
  );

  return router;
}
