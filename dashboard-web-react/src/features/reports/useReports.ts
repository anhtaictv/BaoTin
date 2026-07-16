import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReportDetail, listReports, type ReportsFilters } from './reportsApi';

/** 20s poll so incoming citizen reports appear without a manual refresh — same interval as
 * dashboard-web/lib/features/reports/reports_providers.dart's _reportsPollTickProvider. */
const REPORT_LIST_POLL_MS = 20_000;

export function useReportList(filters: ReportsFilters) {
  return useQuery({
    queryKey: ['reports', 'list', filters],
    queryFn: () => listReports(filters),
    refetchInterval: REPORT_LIST_POLL_MS,
  });
}

export function useReportDetail(reportId: string | null) {
  return useQuery({
    queryKey: ['reports', 'detail', reportId],
    queryFn: () => getReportDetail(reportId!),
    enabled: reportId != null,
  });
}

export function useInvalidateReports() {
  const queryClient = useQueryClient();
  return (reportId: string) => {
    queryClient.invalidateQueries({ queryKey: ['reports', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
  };
}
