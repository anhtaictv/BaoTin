import type { Request, Response } from "express";
import type { SearchAssistantService } from "../../services/searchAssistant.service.js";

export function createSearchController(service: SearchAssistantService) {
  return {
    async search(req: Request, res: Response) {
      const { query } = req.body as { query: string };
      const data = await service.search(query);
      res.status(200).json({ success: true, data, error: null });
    },
  };
}

export type SearchController = ReturnType<typeof createSearchController>;
