import type { Request, Response } from "express";
import type { ReportLifecycleService } from "../../services/reportLifecycle.service.js";
import type { ReportCategorySuggester } from "../../services/reportClassifier.js";
import { extractExifGps, validateImageBuffer } from "./imageValidation.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createReportsController(
  reportLifecycle: ReportLifecycleService,
  categorySuggester: ReportCategorySuggester,
) {
  return {
    async createReport(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { category, description, location, clientRequestId } = req.body as {
        category: string;
        description?: string;
        location: { lat: number; lng: number; source: string };
        clientRequestId?: string;
      };

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const attachments = [];
      for (const file of files) {
        const validation = await validateImageBuffer(file.buffer);
        if (!validation.valid) {
          throw new HttpError(400, "INVALID_ATTACHMENT", validation.reason ?? "Ảnh không hợp lệ.");
        }
        const exifGps = await extractExifGps(file.buffer);
        attachments.push({ buffer: file.buffer, mimetype: file.mimetype, exifGps });
      }

      const result = await reportLifecycle.createCitizenReport({
        userId: req.user.id,
        category,
        description,
        location,
        attachments,
        clientRequestId,
      });

      res.status(201).json({ success: true, data: result, error: null });
    },

    async createEmergencyReport(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { emergencyType, location, clientRequestId } = req.body as {
        emergencyType: string;
        location: { lat: number; lng: number };
        clientRequestId?: string;
      };

      const result = await reportLifecycle.createEmergencyReport({
        userId: req.user.id,
        emergencyType,
        location,
        clientRequestId,
      });

      res.status(201).json({ success: true, data: result, error: null });
    },

    async listMine(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const reports = await reportLifecycle.listMyReports(req.user.id);
      res.status(200).json({ success: true, data: reports, error: null });
    },

    async getStatus(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const status = await reportLifecycle.getReportStatus(req.params.id as string, req.user.id);
      res.status(200).json({ success: true, data: status, error: null });
    },

    /** Suggestion only — the citizen still picks the final category in the dropdown before
     * ever submitting (CLAUDE.md #3's human-in-the-loop spirit applies here too: no step in
     * this app ever files a report with an AI-chosen category the person never saw). */
    async classifySuggestion(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { description } = req.body as { description: string };
      const category = await categorySuggester.suggestCategory(description);
      res.status(200).json({ success: true, data: { category }, error: null });
    },
  };
}

export type ReportsController = ReturnType<typeof createReportsController>;
