import type { Request, Response } from "express";
import type { LegalLookupService } from "../../services/legalLookup.service.js";

export function createLegalLookupController(service: LegalLookupService) {
  return {
    async lookup(req: Request, res: Response) {
      const { query } = req.body as { query: string };
      const data = await service.lookup(query);
      res.status(200).json({ success: true, data, error: null });
    },
  };
}

export type LegalLookupController = ReturnType<typeof createLegalLookupController>;
