import { Router } from "express";
import type { SignalsController } from "./signals.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { listSignalsQuerySchema, signalIdParamsSchema } from "../../validation/schemas/signal.schema.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;

/** Giai đoạn 2 "kênh tình báo mở" — mounted at "/officer/signals", separate base from reports. */
export function createSignalsRoutes(controller: SignalsController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get(
    "/",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(listSignalsQuerySchema, "query"),
    asyncHandler(controller.list),
  );

  router.get(
    "/:id",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(signalIdParamsSchema, "params"),
    asyncHandler(controller.detail),
  );

  return router;
}
