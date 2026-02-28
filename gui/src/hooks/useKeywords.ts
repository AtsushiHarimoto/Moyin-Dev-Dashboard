import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keywordsApi } from '../utils/api';

export function useKeywordPresets() {
  return useQuery({
    queryKey: ['keyword-presets'],
    queryFn: () => keywordsApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshKeywords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ useAi }: { useAi?: boolean } = {}) =>
      keywordsApi.refresh(useAi),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-refresh-status'] });
    },
  });
}

export function useKeywordRefreshStatus() {
  return useQuery({
    queryKey: ['keyword-refresh-status'],
    queryFn: () => keywordsApi.getRefreshStatus(),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return false;
      return job.status === 'queued' || job.status === 'running' ? 1500 : false;
    },
  });
}

export function useCreateKeywordPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ category, icon, keywords }: { category: string; icon: string; keywords: string }) =>
      keywordsApi.create(category, icon, keywords),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-presets'] });
    },
  });
}

export function useDeleteKeywordPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      keywordsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-presets'] });
    },
  });
}
