import { useQuery } from '@tanstack/react-query';
import { getSignalDetail, listSignals, type SignalsFilters } from './signalsApi';

export function useSignalList(filters: SignalsFilters) {
  return useQuery({ queryKey: ['signals', 'list', filters], queryFn: () => listSignals(filters) });
}

export function useSignalDetail(signalId: string | null) {
  return useQuery({
    queryKey: ['signals', 'detail', signalId],
    queryFn: () => getSignalDetail(signalId!),
    enabled: signalId != null,
  });
}
