import type { Request, Response } from "express";
import type { WantedNoticesService } from "../../services/wantedNotices.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createWantedNoticesController(service: WantedNoticesService) {
  return {
    async list(_req: Request, res: Response) {
      const result = await service.list();
      res.status(200).json({ success: true, data: result, error: null });
    },

    async create(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const file = req.file as Express.Multer.File | undefined;
      if (!file) throw new HttpError(400, "MISSING_PHOTO", "Thiếu ảnh lệnh truy nã.");

      const result = await service.create({
        postedById: req.user.id,
        buffer: file.buffer,
        mimetype: file.mimetype,
      });

      res.status(201).json({ success: true, data: result, error: null });
    },

    async update(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const file = req.file as Express.Multer.File | undefined;
      if (!file) throw new HttpError(400, "MISSING_PHOTO", "Thiếu ảnh lệnh truy nã.");

      const result = await service.update(req.params.id as string, {
        buffer: file.buffer,
        mimetype: file.mimetype,
      });

      res.status(200).json({ success: true, data: result, error: null });
    },

    async remove(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      await service.remove(req.params.id as string);
      res.status(200).json({ success: true, data: { removed: true }, error: null });
    },
  };
}

export type WantedNoticesController = ReturnType<typeof createWantedNoticesController>;
