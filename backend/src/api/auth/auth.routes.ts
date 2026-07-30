import { Router } from "express";
import type { AuthController } from "./auth.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  officerLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshTokenSchema,
  registerDeviceTokenSchema,
} from "../../validation/schemas/auth.schema.js";
import {
  officerLoginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  refreshTokenLimiter,
} from "../../middleware/rateLimiters.js";

export function createAuthRoutes(controller: AuthController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.post(
    "/otp/request",
    otpRequestLimiter,
    validateRequest(otpRequestSchema),
    asyncHandler(controller.requestOtp),
  );

  router.post(
    "/otp/verify",
    otpVerifyLimiter,
    validateRequest(otpVerifySchema),
    asyncHandler(controller.verifyOtp),
  );

  router.post(
    "/officer/login",
    officerLoginLimiter,
    validateRequest(officerLoginSchema),
    asyncHandler(controller.officerLogin),
  );

  router.post(
    "/refresh",
    refreshTokenLimiter,
    validateRequest(refreshTokenSchema),
    asyncHandler(controller.refresh),
  );

  router.post("/sessions/revoke-all", requireAuth([]), asyncHandler(controller.revokeAllSessions));

  router.post(
    "/device-token",
    requireAuth([]),
    validateRequest(registerDeviceTokenSchema),
    asyncHandler(controller.registerDeviceToken),
  );

  return router;
}
