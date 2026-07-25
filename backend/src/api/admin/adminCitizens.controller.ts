import type { Request, Response } from "express";
import type { AccountRegistrationService } from "../../services/accountRegistration.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createAdminCitizensController(service: AccountRegistrationService) {
  return {
    async listLocked(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const result = await service.listLockedCitizens(req.user.id);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async unlock(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      await service.unlockCitizen(req.user.id, req.params.id as string);
      res.status(200).json({ success: true, data: { unlocked: true }, error: null });
    },
  };
}

export type AdminCitizensController = ReturnType<typeof createAdminCitizensController>;
