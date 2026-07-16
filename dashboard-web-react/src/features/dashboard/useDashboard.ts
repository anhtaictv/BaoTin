import { useQuery } from '@tanstack/react-query';
import {
  getCameraQueue,
  getDistrictOptions,
  getOverview,
  getResponseTimeByDistrict,
  getResponseTimeByOfficer,
  getVolumeTrend,
  type DashboardFilters,
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

export function useVolumeTrend(filters: DashboardFilters) {
  return useQuery({ queryKey: ['dashboard', 'volume-trend', filters], queryFn: () => getVolumeTrend(filters) });
}

export function useCameraQueue() {
  return useQuery({ queryKey: ['dashboard', 'camera-queue'], queryFn: getCameraQueue });
}
