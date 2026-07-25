import type { Request, Response } from "express";
import type { NewsFeedService } from "../../services/newsFeed.service.js";

export function createNewsFeedController(service: NewsFeedService) {
  return {
    async list(_req: Request, res: Response) {
      const result = await service.list();
      res.status(200).json({ success: true, data: result, error: null });
    },
  };
}

export type NewsFeedController = ReturnType<typeof createNewsFeedController>;
