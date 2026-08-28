import { Router } from "express";
import type { CommuneAssignmentController } from "./communeAssignment.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  assignOldDistrictSchema,
  districtIdParamsSchema,
  subordinateParamsSchema,
} from "../../validation/schemas/communeAssignment.schema.js";

const ANY_OFFICER_ROLE = ["officer", "senior_officer", "commune_head", "admin"] as const;

/** Trưởng xã chia nhỏ địa bàn (xã/phường cũ) trong xã/phường mới mình phụ trách cho tài
 * khoản cấp dưới — mounted at "/officer/commune". Read (old-ward list, subordinate roster)
 * is any authenticated officer role ("các tài khoản còn lại chỉ xem" — CLAUDE.md phân
 * quyền); write (assign) is commune_head/admin only, with ownership enforced inside
 * communeAssignment.service.ts (a commune_head may only write their own district). */
export function createCommuneAssignmentRoutes(controller: CommuneAssignmentController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/my-district", requireAuth([...ANY_OFFICER_ROLE]), asyncHandler(controller.myDistrict));

  router.get(
    "/:districtId/old-wards",
    requireAuth([...ANY_OFFICER_ROLE]),
    validateRequest(districtIdParamsSchema, "params"),
    asyncHandler(controller.listOldWards),
  );

  router.get(
    "/:districtId/subordinates",
    requireAuth([...ANY_OFFICER_ROLE]),
    validateRequest(districtIdParamsSchema, "params"),
    asyncHandler(controller.listSubordinates),
  );

  router.post(
    "/:districtId/subordinates/:officerId/assignment",
    requireAuth(["commune_head", "admin"]),
    validateRequest(subordinateParamsSchema, "params"),
    validateRequest(assignOldDistrictSchema),
    asyncHandler(controller.assignSubordinate),
  );

  return router;
}
