import type { Request, Response } from "express";
import type { TrafficAccidentAlertsService } from "../../services/trafficAccidentAlerts.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createTrafficAccidentsController(service: TrafficAccidentAlertsService) {
  return {
    /** Called by the detector worker (X-Detector-Api-Key, not a user JWT) — see
     * middleware/detectorApiKey.ts. */
    async ingest(req: Request, res: Response) {
      const { cameraId, plateNumbers, detectedAt } = req.body as {
        cameraId: string;
        plateNumbers?: string;
        detectedAt?: string;
      };
      const file = req.file as Express.Multer.File | undefined;

      const result = await service.ingestDetection({
        cameraId,
        plateNumbers: plateNumbers
          ? plateNumbers.split(",").map((p) => p.trim()).filter(Boolean)
          : [],
        detectedAt: detectedAt ? new Date(detectedAt) : undefined,
        thumbnail: file ? { buffer: file.buffer, mimetype: file.mimetype } : undefined,
      });
      res.status(201).json({ success: true, data: result, error: null });
    },

    async list(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const query = req.query as { district_id?: string; status?: string };
      const alerts = await service.listAlerts(req.user, { districtId: query.district_id, status: query.status });
      res.status(200).json({ success: true, data: alerts, error: null });
    },

    async detail(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const alert = await service.getAlertDetail(req.user, req.params.id as string);
      res.status(200).json({ success: true, data: alert, error: null });
    },

    async confirm(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const result = await service.confirmAlert(req.user, req.params.id as string);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async dismiss(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const result = await service.dismissAlert(req.user, req.params.id as string);
      res.status(200).json({ success: true, data: result, error: null });
    },
  };
}

export type TrafficAccidentsController = ReturnType<typeof createTrafficAccidentsController>;
