import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analysisApi, emailApi } from '../utils/api';

export function useAnalysisReports() {
  return useQuery({
    queryKey: ['analysis-reports'],
    queryFn: () => analysisApi.getReports(),
  });
}

export function useLatestInsights() {
  return useQuery({
    queryKey: ['analysis-insights'],
    queryFn: () => analysisApi.getLatestInsights(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keywords, days, label }: { keywords?: string; days?: number; label?: string }) =>
      analysisApi.start(keywords, days, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
      queryClient.invalidateQueries({ queryKey: ['analysis-insights'] });
    },
  });
}

export function useStartBatchAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presets, days }: {
      presets: Array<{ label: string; keywords: string }>;
      days?: number;
    }) => analysisApi.batchStart(presets, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
    },
  });
}

export function useCancelBatchAnalysis() {
  return useMutation({
    mutationFn: () => analysisApi.batchCancel(),
  });
}

export function useEmailStatus() {
  return useQuery({
    queryKey: ['email-status'],
    queryFn: () => emailApi.getStatus(),
    staleTime: 60 * 1000,
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: () => emailApi.sendTest(),
  });
}
