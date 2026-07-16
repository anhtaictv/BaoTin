import { Router } from "express";
import type { WebAccountController } from "./webAccount.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { webLoginLimiter } from "../../middleware/rateLimiters.js";
import {
  changePasswordSchema,
  officerIdParamsSchema,
  updateAccountInfoSchema,
  webLoginSchema,
} from "../../validation/schemas/webAccount.schema.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;

/**
 * dashboard-web-react's auth surface — mounted at "/" (routes below spell out their full
 * path themselves) so this can sit alongside the existing OTP-based auth/officer routers
 * without touching either of them.
 */
export function createWebAccountRoutes(controller: WebAccountController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.post(
    "/auth/web/login",
    webLoginLimiter,
    validateRequest(webLoginSchema),
    asyncHandler(controller.login),
  );

  router.get("/web-accounts/me", requireAuth([...OFFICER_ROLES]), asyncHandler(controller.getMyAccount));

  router.patch(
    "/web-accounts/me/password",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(changePasswordSchema),
    asyncHandler(controller.changeMyPassword),
  );

  router.patch(
    "/web-accounts/me/info",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(updateAccountInfoSchema),
    asyncHandler(controller.updateMyInfo),
  );

  router.get("/admin/web-accounts", requireAuth(["admin"]), asyncHandler(controller.listWebAccounts));

  router.post(
    "/admin/web-accounts/:officerId/reset-password",
    requireAuth(["admin"]),
    validateRequest(officerIdParamsSchema, "params"),
    asyncHandler(controller.resetPassword),
  );

  return router;
}
