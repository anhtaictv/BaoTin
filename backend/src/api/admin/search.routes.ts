import { Router } from "express";
import type { SearchController } from "./search.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { searchQuerySchema } from "../../validation/schemas/search.schema.js";

const SEARCH_ROLES = ["admin", "senior_officer"] as const;

/** Mounted at "/admin/search" — same role gate as dashboard.routes.ts, not available to plain
 * "officer" accounts. */
export function createSearchRoutes(controller: SearchController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.post(
    "/",
    requireAuth([...SEARCH_ROLES]),
    validateRequest(searchQuerySchema),
    asyncHandler(controller.search),
  );

  return router;
}
