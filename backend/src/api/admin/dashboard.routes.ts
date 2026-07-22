import { Router } from "express";
import type { DashboardController } from "./dashboard.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  dashboardDaysQuerySchema,
  dashboardOverviewQuerySchema,
  dashboardVolumeTrendQuerySchema,
} from "../../validation/schemas/dashboard.schema.js";

const DASHBOARD_ROLES = ["admin", "senior_officer"] as const;

/** v1.2 — mounted at "/admin/dashboard". Not available to plain "officer" accounts. */
export function createDashboardRoutes(controller: DashboardController, requireAuth: RequireAuth): Router {
  const router = Router();
  const requireDashboardRole = requireAuth([...DASHBOARD_ROLES]);

  router.get(
    "/overview",
    requireDashboardRole,
    validateRequest(dashboardOverviewQuerySchema, "query"),
    asyncHandler(controller.overview),
  );

  router.get(
    "/response-time-by-district",
    requireDashboardRole,
    validateRequest(dashboardDaysQuerySchema, "query"),
    asyncHandler(controller.responseTimeByDistrict),
  );

  router.get(
    "/response-time-by-officer",
    requireDashboardRole,
    validateRequest(dashboardDaysQuerySchema, "query"),
    asyncHandler(controller.responseTimeByOfficer),
  );

  router.get(
    "/volume-trend",
    requireDashboardRole,
    validateRequest(dashboardVolumeTrendQuerySchema, "query"),
    asyncHandler(controller.volumeTrend),
  );

  router.get(
    "/report-count-by-district",
    requireDashboardRole,
    validateRequest(dashboardDaysQuerySchema, "query"),
    asyncHandler(controller.reportCountByDistrict),
  );

  router.get(
    "/by-category",
    requireDashboardRole,
    validateRequest(dashboardDaysQuerySchema, "query"),
    asyncHandler(controller.byCategory),
  );

  router.get(
    "/report-locations",
    requireDashboardRole,
    validateRequest(dashboardDaysQuerySchema, "query"),
    asyncHandler(controller.reportLocations),
  );

  router.get("/camera-queue", requireDashboardRole, asyncHandler(controller.cameraQueue));
  router.get("/districts", requireDashboardRole, asyncHandler(controller.districts));

  return router;
}
