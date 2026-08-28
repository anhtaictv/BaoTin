import type { Request, Response } from "express";
import type { CommuneAssignmentService } from "../../services/communeAssignment.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createCommuneAssignmentController(service: CommuneAssignmentService) {
  return {
    /** Convenience for the commune_head's own UI to discover which district they head —
     * admin has no single "own district" (unrestricted across all), so this returns null
     * for any role other than commune_head. */
    async myDistrict(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const result = await service.getCommuneHeadDistrict(req.user.id);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async listOldWards(req: Request, res: Response) {
      const { districtId } = req.params as unknown as { districtId: string };
      const result = await service.listOldWardsForDistrict(districtId);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async listSubordinates(req: Request, res: Response) {
      const { districtId } = req.params as unknown as { districtId: string };
      const result = await service.listSubordinates(districtId);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async assignSubordinate(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { districtId, officerId } = req.params as unknown as { districtId: string; officerId: string };
      const { oldDistrictId } = req.body as { oldDistrictId: string | null };
      await service.assignSubordinateOldDistrict(req.user, districtId, officerId, oldDistrictId);
      res.status(200).json({ success: true, data: { assigned: true }, error: null });
    },
  };
}

export type CommuneAssignmentController = ReturnType<typeof createCommuneAssignmentController>;
