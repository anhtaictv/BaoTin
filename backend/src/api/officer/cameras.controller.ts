import type { Request, Response } from "express";
import type { CameraExtractionService } from "../../services/cameraExtraction.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createCamerasController(service: CameraExtractionService) {
  return {
    async nearbyCameras(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { radius_m } = req.query as { radius_m?: number };
      const cameras = await service.nearbyCameras(req.user, req.params.id as string, radius_m);
      res.status(200).json({ success: true, data: cameras, error: null });
    },

    async createExtractionRequest(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { cameraId, timeRangeStart, timeRangeEnd, note } = req.body as {
        cameraId: string;
        timeRangeStart: Date;
        timeRangeEnd: Date;
        note?: string;
      };
      const result = await service.createExtractionRequest(req.user, req.params.id as string, {
        cameraId,
        timeRangeStart,
        timeRangeEnd,
        note,
      });
      res.status(201).json({ success: true, data: result, error: null });
    },

    async listExtractionRequests(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const requests = await service.listExtractionRequests(req.user, req.params.id as string);
      res.status(200).json({ success: true, data: requests, error: null });
    },
  };
}

export type CamerasController = ReturnType<typeof createCamerasController>;
