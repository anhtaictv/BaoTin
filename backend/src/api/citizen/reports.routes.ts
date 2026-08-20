import { Router } from "express";
import type { ReportsController } from "./reports.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { uploadAttachments } from "./upload.middleware.js";
import {
  classifyReportSchema,
  createEmergencyReportSchema,
  createReportSchema,
} from "../../validation/schemas/report.schema.js";
import { emergencyReportLimiter, createReportLimiter, classifySuggestionLimiter } from "../../middleware/rateLimiters.js";

export function createReportsRoutes(controller: ReportsController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.post(
    "/",
    requireAuth(["citizen"]),
    createReportLimiter,
    uploadAttachments,
    validateRequest(createReportSchema),
    asyncHandler(controller.createReport),
  );

  // Emergency path: rate-limited only by an in-memory counter (no DB round-trip added),
  // per API_SPEC.md's explicit "must not add latency" requirement — see rateLimiters.ts.
  router.post(
    "/emergency",
    emergencyReportLimiter,
    requireAuth(["citizen"]),
    validateRequest(createEmergencyReportSchema),
    asyncHandler(controller.createEmergencyReport),
  );

  router.get("/mine", requireAuth(["citizen"]), asyncHandler(controller.listMine));
  router.get("/:id/status", requireAuth(["citizen"]), asyncHandler(controller.getStatus));

  router.post(
    "/classify-suggestion",
    requireAuth(["citizen"]),
    classifySuggestionLimiter,
    validateRequest(classifyReportSchema),
    asyncHandler(controller.classifySuggestion),
  );

  return router;
}
