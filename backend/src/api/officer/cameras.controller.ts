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
      const { cameraIds, timeRangeStart, timeRangeEnd, note } = req.body as {
        cameraIds: string[];
        timeRangeStart: Date;
        timeRangeEnd: Date;
        note?: string;
      };
      const result = await service.createExtractionRequest(req.user, req.params.id as string, {
        cameraIds,
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

    async listDistrictCameras(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const cameras = await service.listDistrictCameras(req.user);
      res.status(200).json({ success: true, data: cameras, error: null });
    },

    async createCamera(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const camera = await service.createCamera(req.body);
      res.status(201).json({ success: true, data: camera, error: null });
    },

    async updateCamera(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const camera = await service.updateCamera(req.params.id as string, req.body);
      res.status(200).json({ success: true, data: camera, error: null });
    },

    async deleteCamera(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      await service.deleteCamera(req.params.id as string);
      res.status(200).json({ success: true, data: null, error: null });
    },
  };
}

export type CamerasController = ReturnType<typeof createCamerasController>;
