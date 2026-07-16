import type { Request, Response } from "express";
import type { AreaAlertsService } from "../../services/areaAlerts.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createAreaAlertsController(service: AreaAlertsService) {
  return {
    async get(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { lat, lng } = req.query as unknown as { lat: number; lng: number };
      const result = await service.getAreaAlerts({ lat, lng });
      res.status(200).json({ success: true, data: result, error: null });
    },
  };
}

export type AreaAlertsController = ReturnType<typeof createAreaAlertsController>;
