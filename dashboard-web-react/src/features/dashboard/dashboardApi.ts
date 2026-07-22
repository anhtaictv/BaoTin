import { apiClient } from '../../core/apiClient';

export interface DashboardFilters {
  districtId?: string;
  days: number;
}

export async function getOverview(filters: DashboardFilters) {
  const res = await apiClient.get('/admin/dashboard/overview', {
    params: { district_id: filters.districtId, days: filters.days },
  });
  return res.data.data as {
    totalReports: number;
    byStatus: Record<string, number>;
    avgResponseTimeSeconds: number | null;
  };
}

export async function getResponseTimeByDistrict(days: number) {
  const res = await apiClient.get('/admin/dashboard/response-time-by-district', { params: { days } });
  return res.data.data as { districtName: string; avgResponseTimeSeconds: number; reportCount: number }[];
}

export async function getResponseTimeByOfficer(filters: DashboardFilters) {
  const res = await apiClient.get('/admin/dashboard/response-time-by-officer', {
    params: { district_id: filters.districtId, days: filters.days },
  });
  return res.data.data as { officerName: string; avgResponseTimeSeconds: number; reportCount: number }[];
}

export type TrendPeriod = 'day' | 'week' | 'month';

export async function getVolumeTrend(filters: DashboardFilters, period: TrendPeriod = 'day') {
  const res = await apiClient.get('/admin/dashboard/volume-trend', {
    params: { district_id: filters.districtId, days: filters.days, period },
  });
  return res.data.data as { date: string; count: number }[];
}

/** "So sánh giữa các xã/phường" — busiest wards first, distinct from
 * getResponseTimeByDistrict (which ranks by response time instead of report count). */
export async function getReportCountByDistrict(days: number) {
  const res = await apiClient.get('/admin/dashboard/report-count-by-district', { params: { days } });
  return res.data.data as { districtId: string; districtName: string; reportCount: number }[];
}

export async function getByCategory(filters: DashboardFilters) {
  const res = await apiClient.get('/admin/dashboard/by-category', {
    params: { district_id: filters.districtId, days: filters.days },
  });
  return res.data.data as { category: string; count: number }[];
}

export interface ReportLocation {
  id: string;
  lat: number;
  lng: number;
  status: string;
  category: string;
  urgency: string;
  createdAt: string;
}

export async function getReportLocations(filters: DashboardFilters) {
  const res = await apiClient.get('/admin/dashboard/report-locations', {
    params: { district_id: filters.districtId, days: filters.days },
  });
  return res.data.data as ReportLocation[];
}

export async function getCameraQueue() {
  const res = await apiClient.get('/admin/dashboard/camera-queue');
  return res.data.data as Record<string, number>;
}

export async function getDistrictOptions() {
  const res = await apiClient.get('/admin/dashboard/districts');
  return res.data.data as { id: string; tenXa: string }[];
}
