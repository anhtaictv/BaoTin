import { apiClient } from '../../core/apiClient';

export interface SignalsFilters {
  districtId?: string;
  trustLevel?: string;
}

export async function listSignals(filters: SignalsFilters) {
  const res = await apiClient.get('/officer/signals', {
    params: { district_id: filters.districtId, trust_level: filters.trustLevel },
  });
  return res.data.data as {
    id: string;
    sourceName: string | null;
    trustLevel: string;
    summary: string | null;
    publishedAt: string | null;
    heat: { score: number; level: string } | null;
  }[];
}

export async function getSignalDetail(signalId: string) {
  return (await apiClient.get(`/officer/signals/${signalId}`)).data.data as Record<string, unknown>;
}
