import type { Request, Response } from "express";
import type { BroadcastAlertsService } from "../../services/broadcastAlerts.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createBroadcastAlertsController(service: BroadcastAlertsService) {
  return {
    async listDistricts(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const districts = await service.listAvailableDistricts(req.user);
      res.status(200).json({ success: true, data: districts, error: null });
    },

    async create(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { districtId, message, urgency } = req.body as {
        districtId: string;
        message: string;
        urgency?: "emergency" | "normal";
      };

      const result = await service.create({
        subject: req.user,
        districtId,
        message,
        urgency: urgency ?? "normal",
      });

      res.status(201).json({ success: true, data: result, error: null });
    },
  };
}

export type BroadcastAlertsController = ReturnType<typeof createBroadcastAlertsController>;
