import { apiClient } from '../../core/apiClient';

export interface ReportsFilters {
  status?: string;
  urgency?: string;
  districtId?: string;
}

export async function listReports(filters: ReportsFilters) {
  const res = await apiClient.get('/officer/reports', {
    params: { status: filters.status, urgency: filters.urgency, district_id: filters.districtId },
  });
  return res.data.data.reports as { id: string; category: string | null; status: string; urgency: string; createdAt: string }[];
}

export async function getReportDetail(reportId: string) {
  const res = await apiClient.get(`/officer/reports/${reportId}`);
  return res.data.data as Record<string, unknown>;
}

export async function updateReportStatus(reportId: string, status: string, note?: string): Promise<void> {
  await apiClient.patch(`/officer/reports/${reportId}/status`, { status, note: note?.trim() || undefined });
}
