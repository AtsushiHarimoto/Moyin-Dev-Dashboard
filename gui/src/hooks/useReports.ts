import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../utils/api';

export function useReports(archived: boolean) {
  return useQuery({
    queryKey: ['reports', { archived }],
    queryFn: () => reportsApi.list(archived),
  });
}

export function useReportDetail(id: string | null) {
  return useQuery({
    queryKey: ['report-detail', id],
    queryFn: () => reportsApi.getDetail(id as string),
    enabled: Boolean(id),
  });
}

export function useMarkReportAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportId: string) => reportsApi.markAsRead(reportId),
    onSuccess: () => {
      // Invalidate reports list to update read status
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportId: string) => reportsApi.deleteReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
