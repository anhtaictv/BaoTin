import type { Request, Response } from "express";
import type { DashboardStatsService } from "../../services/dashboardStats.service.js";

export function createDashboardController(service: DashboardStatsService) {
  return {
    async overview(req: Request, res: Response) {
      const { district_id, days } = req.query as unknown as { district_id?: string; days: number };
      const data = await service.getOverview({ districtId: district_id, days });
      res.status(200).json({ success: true, data, error: null });
    },

    async responseTimeByDistrict(req: Request, res: Response) {
      const { days } = req.query as unknown as { days: number };
      const data = await service.getResponseTimeByDistrict({ days });
      res.status(200).json({ success: true, data, error: null });
    },

    async responseTimeByOfficer(req: Request, res: Response) {
      const { district_id, days } = req.query as unknown as { district_id?: string; days: number };
      const data = await service.getResponseTimeByOfficer({ districtId: district_id, days });
      res.status(200).json({ success: true, data, error: null });
    },

    async volumeTrend(req: Request, res: Response) {
      const { district_id, days, period } = req.query as unknown as {
        district_id?: string;
        days: number;
        period: "day" | "week" | "month";
      };
      const data = await service.getVolumeTrend({ days, districtId: district_id, period });
      res.status(200).json({ success: true, data, error: null });
    },

    async reportCountByDistrict(req: Request, res: Response) {
      const { days } = req.query as unknown as { days: number };
      const data = await service.getReportCountByDistrict({ days });
      res.status(200).json({ success: true, data, error: null });
    },

    async byCategory(req: Request, res: Response) {
      const { district_id, days } = req.query as unknown as { district_id?: string; days: number };
      const data = await service.getByCategory({ days, districtId: district_id });
      res.status(200).json({ success: true, data, error: null });
    },

    async reportLocations(req: Request, res: Response) {
      const { district_id, days } = req.query as unknown as { district_id?: string; days: number };
      const data = await service.getReportLocations({ days, districtId: district_id });
      res.status(200).json({ success: true, data, error: null });
    },

    async cameraQueue(_req: Request, res: Response) {
      const data = await service.getCameraQueueStats();
      res.status(200).json({ success: true, data, error: null });
    },

    async districts(_req: Request, res: Response) {
      const data = await service.getDistrictOptions();
      res.status(200).json({ success: true, data, error: null });
    },
  };
}

export type DashboardController = ReturnType<typeof createDashboardController>;
