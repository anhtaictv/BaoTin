import { Router } from "express";
import type { WebAccountController } from "./webAccount.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { webLoginLimiter } from "../../middleware/rateLimiters.js";
import {
  changePasswordSchema,
  officerIdParamsSchema,
  totpConfirmSchema,
  totpDisableSchema,
  totpLoginSchema,
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

  // 2nd step of login for an account with TOTP 2FA enabled — same IP/username-shaped rate
  // limit as the password step above (webLoginLimiter keys on req.body.username, which this
  // request doesn't have, so it effectively falls back to per-IP; the per-account 5-attempt
  // lockout already happened at the password step).
  router.post(
    "/auth/web/login/totp",
    webLoginLimiter,
    validateRequest(totpLoginSchema),
    asyncHandler(controller.loginTotp),
  );

  router.get("/web-accounts/me", requireAuth([...OFFICER_ROLES]), asyncHandler(controller.getMyAccount));

  router.post(
    "/web-accounts/me/totp/setup",
    requireAuth([...OFFICER_ROLES]),
    asyncHandler(controller.setupTotp),
  );

  router.post(
    "/web-accounts/me/totp/confirm",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(totpConfirmSchema),
    asyncHandler(controller.confirmTotp),
  );

  router.post(
    "/web-accounts/me/totp/disable",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(totpDisableSchema),
    asyncHandler(controller.disableTotp),
  );

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
