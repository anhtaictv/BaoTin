import { useQuery } from '@tanstack/react-query';
import {
  getByCategory,
  getCameraQueue,
  getDistrictOptions,
  getOverview,
  getReportCountByDistrict,
  getReportLocations,
  getResponseTimeByDistrict,
  getResponseTimeByOfficer,
  getVolumeTrend,
  type DashboardFilters,
  type TrendPeriod,
} from './dashboardApi';

export function useDistrictOptions() {
  return useQuery({ queryKey: ['districts'], queryFn: getDistrictOptions });
}

export function useOverview(filters: DashboardFilters) {
  return useQuery({ queryKey: ['dashboard', 'overview', filters], queryFn: () => getOverview(filters) });
}

/** Deliberately NOT filtered by district — "Thời gian phản hồi TB theo địa bàn" is a
 * cross-district comparison chart, filtering it to one district would defeat its purpose
 * (same decision as dashboard-web/lib/features/dashboard/dashboard_overview_tab.dart). */
export function useResponseTimeByDistrict(days: number) {
  return useQuery({
    queryKey: ['dashboard', 'response-time-by-district', days],
    queryFn: () => getResponseTimeByDistrict(days),
  });
}

export function useResponseTimeByOfficer(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'response-time-by-officer', filters],
    queryFn: () => getResponseTimeByOfficer(filters),
  });
}

export function useVolumeTrend(filters: DashboardFilters, period: TrendPeriod) {
  return useQuery({
    queryKey: ['dashboard', 'volume-trend', filters, period],
    queryFn: () => getVolumeTrend(filters, period),
  });
}

/** Same "always all districts" reasoning as useResponseTimeByDistrict. */
export function useReportCountByDistrict(days: number) {
  return useQuery({
    queryKey: ['dashboard', 'report-count-by-district', days],
    queryFn: () => getReportCountByDistrict(days),
  });
}

export function useByCategory(filters: DashboardFilters) {
  return useQuery({ queryKey: ['dashboard', 'by-category', filters], queryFn: () => getByCategory(filters) });
}

export function useReportLocations(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'report-locations', filters],
    queryFn: () => getReportLocations(filters),
  });
}

export function useCameraQueue() {
  return useQuery({ queryKey: ['dashboard', 'camera-queue'], queryFn: getCameraQueue });
}
