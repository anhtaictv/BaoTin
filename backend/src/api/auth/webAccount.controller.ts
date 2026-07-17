import type { Request, Response } from "express";
import type { WebAccountAuthService } from "../../services/webAccountAuth.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createWebAccountController(service: WebAccountAuthService) {
  return {
    async login(req: Request, res: Response) {
      const { username, password } = req.body as { username: string; password: string };
      const result = await service.login(username, password);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async getMyAccount(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const account = await service.getMyAccount(req.user.id);
      res.status(200).json({ success: true, data: account, error: null });
    },

    async changeMyPassword(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
      await service.changePassword(req.user.id, oldPassword, newPassword);
      res.status(200).json({ success: true, data: { changed: true }, error: null });
    },

    async updateMyInfo(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { fullName, unitName } = req.body as { fullName?: string; unitName?: string };
      await service.updateInfo(req.user.id, { fullName, unitName });
      res.status(200).json({ success: true, data: { updated: true }, error: null });
    },

    async listWebAccounts(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const accounts = await service.listWebAccounts(req.user.id);
      res.status(200).json({ success: true, data: accounts, error: null });
    },

    async resetPassword(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const result = await service.resetPassword(req.user.id, req.params.officerId as string);
      res.status(200).json({ success: true, data: result, error: null });
    },
  };
}

export type WebAccountController = ReturnType<typeof createWebAccountController>;
