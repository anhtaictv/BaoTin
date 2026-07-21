import { Router } from "express";
import type { WantedNoticesController } from "./wantedNotices.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { uploadWantedNoticePhoto } from "./uploadPhoto.middleware.js";

const POST_ROLES = ["admin"] as const;

/** "Lệnh truy nã" — mounted at root "/wanted-notices". */
export function createWantedNoticesRoutes(controller: WantedNoticesController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/", requireAuth([]), asyncHandler(controller.list));
  router.post("/", requireAuth([...POST_ROLES]), uploadWantedNoticePhoto, asyncHandler(controller.create));

  return router;
}
