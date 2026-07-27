import { Router } from "express";
import type { WantedNoticesController } from "./wantedNotices.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { wantedNoticeIdParamsSchema } from "../../validation/schemas/wantedNotice.schema.js";
import { uploadWantedNoticePhoto } from "./uploadPhoto.middleware.js";

const MANAGE_ROLES = ["admin"] as const;

/** "Lệnh truy nã" — mounted at root "/wanted-notices". Edit/delete admin-only, same as post. */
export function createWantedNoticesRoutes(controller: WantedNoticesController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/", requireAuth([]), asyncHandler(controller.list));
  router.post("/", requireAuth([...MANAGE_ROLES]), uploadWantedNoticePhoto, asyncHandler(controller.create));
  router.patch(
    "/:id",
    requireAuth([...MANAGE_ROLES]),
    validateRequest(wantedNoticeIdParamsSchema, "params"),
    uploadWantedNoticePhoto,
    asyncHandler(controller.update),
  );
  router.delete(
    "/:id",
    requireAuth([...MANAGE_ROLES]),
    validateRequest(wantedNoticeIdParamsSchema, "params"),
    asyncHandler(controller.remove),
  );

  return router;
}
