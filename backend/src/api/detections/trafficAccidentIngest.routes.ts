import { Router } from "express";
import multer from "multer";
import type { RequestHandler } from "express";
import type { TrafficAccidentsController } from "./trafficAccidents.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ingestTrafficAccidentSchema } from "../../validation/schemas/trafficAccidentAlert.schema.js";

const uploadThumbnail = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Mounted at "/detections/traffic-accidents" — the detector worker, not a citizen/officer
 * client, so auth is requireDetectorApiKey (middleware/detectorApiKey.ts) rather than JWT. */
export function createTrafficAccidentIngestRoutes(
  controller: TrafficAccidentsController,
  requireDetectorApiKey: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/",
    requireDetectorApiKey,
    uploadThumbnail.single("thumbnail"),
    validateRequest(ingestTrafficAccidentSchema),
    asyncHandler(controller.ingest),
  );

  return router;
}
