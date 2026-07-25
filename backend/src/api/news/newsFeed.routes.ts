import { Router } from "express";
import type { NewsFeedController } from "./newsFeed.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

/** Tin tức bocongan.gov.vn — read-only, chung cho cả citizen và officer. Mounted at "/news". */
export function createNewsFeedRoutes(controller: NewsFeedController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/", requireAuth([]), asyncHandler(controller.list));

  return router;
}
