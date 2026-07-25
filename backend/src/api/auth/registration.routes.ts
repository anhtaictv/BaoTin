import { Router } from "express";
import type { RegistrationController } from "./registration.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { uploadCccdPhotos } from "./cccdUpload.middleware.js";
import {
  changePasswordSchema,
  loginPasswordSchema,
  registerCitizenSchema,
  registerOfficerSchema,
} from "../../validation/schemas/accountRegistration.schema.js";
import { registrationLimiter, webLoginLimiter } from "../../middleware/rateLimiters.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;

/**
 * Username/password registration+login — mounted at "/auth" alongside authRoutes.ts's OTP
 * flow (both routers are `app.use("/auth", ...)`'d in app.ts). Deliberately a separate
 * router/controller/service instead of extending auth.service.ts, so the OTP path stays
 * untouched per the product decision to keep both login methods side by side.
 */
export function createRegistrationRoutes(controller: RegistrationController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.post(
    "/register/citizen",
    registrationLimiter,
    uploadCccdPhotos,
    validateRequest(registerCitizenSchema),
    asyncHandler(controller.registerCitizen),
  );

  router.post(
    "/login/citizen",
    webLoginLimiter,
    validateRequest(loginPasswordSchema),
    asyncHandler(controller.loginCitizen),
  );

  // Self-service — deliberately doesn't check lockedAt (see changeCitizenPassword's comment):
  // a citizen auto-locked for repeated false reports can still manage their own account.
  router.post(
    "/citizen/change-password",
    requireAuth(["citizen"]),
    validateRequest(changePasswordSchema),
    asyncHandler(controller.changeCitizenPassword),
  );

  router.post(
    "/register/officer",
    registrationLimiter,
    validateRequest(registerOfficerSchema),
    asyncHandler(controller.registerOfficer),
  );

  router.post(
    "/login/officer",
    webLoginLimiter,
    validateRequest(loginPasswordSchema),
    asyncHandler(controller.loginOfficer),
  );

  // Self-service, any officer role — not admin-only. requireAuth([...OFFICER_ROLES]) rather
  // than requireAuth([]) so a citizen token can't hit this (it's an officer-only column).
  router.post(
    "/officer/change-password",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(changePasswordSchema),
    asyncHandler(controller.changeOfficerPassword),
  );

  return router;
}
