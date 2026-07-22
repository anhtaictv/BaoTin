import type { Request, Response } from "express";
import type { AccountRegistrationService } from "../../services/accountRegistration.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createOfficerApprovalController(service: AccountRegistrationService) {
  return {
    async listPending(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const result = await service.listPendingOfficers(req.user.id);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async approve(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      await service.approveOfficer(req.user.id, req.params.id as string);
      res.status(200).json({ success: true, data: { approved: true }, error: null });
    },

    async reject(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      await service.rejectOfficer(req.user.id, req.params.id as string);
      res.status(200).json({ success: true, data: { rejected: true }, error: null });
    },
  };
}

export type OfficerApprovalController = ReturnType<typeof createOfficerApprovalController>;
