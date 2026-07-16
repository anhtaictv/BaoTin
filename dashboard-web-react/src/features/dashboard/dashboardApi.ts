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

export async function getVolumeTrend(filters: DashboardFilters) {
  const res = await apiClient.get('/admin/dashboard/volume-trend', {
    params: { district_id: filters.districtId, days: filters.days },
  });
  return res.data.data as { date: string; count: number }[];
}

export async function getCameraQueue() {
  const res = await apiClient.get('/admin/dashboard/camera-queue');
  return res.data.data as Record<string, number>;
}

export async function getDistrictOptions() {
  const res = await apiClient.get('/admin/dashboard/districts');
  return res.data.data as { id: string; tenXa: string }[];
}
