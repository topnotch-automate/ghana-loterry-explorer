import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { analyticsApi } from '../api/client';
import type { FrequencyStats } from '../types';

export const useFrequencyStats = (
  lottoType?: string,
  options?: Omit<UseQueryOptions<FrequencyStats[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['frequency', lottoType],
    queryFn: () => analyticsApi.getFrequency(lottoType ? { lottoType } : undefined),
    staleTime: 10 * 60 * 1000, // 10 minutes - frequency stats don't change often
    ...options,
  });
};
