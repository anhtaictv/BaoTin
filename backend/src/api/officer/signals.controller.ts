import type { Request, Response } from "express";
import type { SignalsService } from "../../services/signals.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createSignalsController(service: SignalsService) {
  return {
    async list(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const query = req.query as { district_id?: string; trust_level?: string; category?: string };
      const signals = await service.listSignals(req.user, {
        districtId: query.district_id,
        trustLevel: query.trust_level,
        category: query.category,
      });
      res.status(200).json({ success: true, data: signals, error: null });
    },

    async detail(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const signal = await service.getSignalDetail(req.user, req.params.id as string);
      res.status(200).json({ success: true, data: signal, error: null });
    },
  };
}

export type SignalsController = ReturnType<typeof createSignalsController>;
