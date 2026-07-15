import type { Request, Response } from "express";
import type { OfficerReportsService } from "../../services/officerReports.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createOfficerReportsController(service: OfficerReportsService) {
  return {
    async list(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const query = req.query as { district_id?: string; status?: string; urgency?: string };
      const reports = await service.listReports(req.user, {
        districtId: query.district_id,
        status: query.status,
        urgency: query.urgency,
      });
      res.status(200).json({ success: true, data: reports, error: null });
    },

    async detail(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const report = await service.getReportDetail(req.user, req.params.id as string);
      res.status(200).json({ success: true, data: report, error: null });
    },

    async updateStatus(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { status, note } = req.body as { status: "verifying" | "confirmed_true" | "confirmed_false"; note?: string };
      const result = await service.updateStatus(req.user, req.params.id as string, { status, note });
      res.status(200).json({ success: true, data: result, error: null });
    },
  };
}

export type OfficerReportsController = ReturnType<typeof createOfficerReportsController>;
