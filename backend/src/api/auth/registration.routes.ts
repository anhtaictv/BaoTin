import { Router } from "express";
import type { RegistrationController } from "./registration.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { uploadCccdPhotos } from "./cccdUpload.middleware.js";
import {
  loginPasswordSchema,
  registerCitizenSchema,
  registerOfficerSchema,
} from "../../validation/schemas/accountRegistration.schema.js";
import { registrationLimiter, webLoginLimiter } from "../../middleware/rateLimiters.js";

/**
 * Username/password registration+login — mounted at "/auth" alongside authRoutes.ts's OTP
 * flow (both routers are `app.use("/auth", ...)`'d in app.ts). Deliberately a separate
 * router/controller/service instead of extending auth.service.ts, so the OTP path stays
 * untouched per the product decision to keep both login methods side by side.
 */
export function createRegistrationRoutes(controller: RegistrationController): Router {
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

  return router;
}
