/**
 * 會話數據 Hooks
 * 使用 React Query 管理服務端狀態
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportApi, sessionsApi, syncApi } from '../utils/api';
import type { Session, SessionGroup, SessionProvider } from '../types';

export interface SyncBatchProgress {
  processedSessions: number;
  totalSessions: number;
  syncedMessages: number;
  syncedSessions: number;
  updatedSessions: number;
}

export async function syncAllInBatches(options?: {
  provider?: SessionProvider;
  batchSize?: number;
  onProgress?: (progress: SyncBatchProgress) => void;
}) {
  const provider = options?.provider ?? 'claude';
  const batchSize = options?.batchSize ?? 20;
  let cursor = 0;
  let hasMore = true;

  const aggregate = {
    sessions: { synced: 0, updated: 0 },
    messages: { synced: 0, processedSessions: 0, totalSessions: 0 },
    errors: [] as string[],
  };

  while (hasMore) {
    const result = await syncApi.syncAll(provider, { cursor, batchSize });

    aggregate.sessions.synced += result.sessions.synced;
    aggregate.sessions.updated += result.sessions.updated;
    aggregate.messages.synced += result.messages.synced || 0;
    aggregate.messages.processedSessions = result.messages.processedSessions ?? aggregate.messages.processedSessions;
    aggregate.messages.totalSessions = result.messages.totalSessions ?? aggregate.messages.totalSessions;
    aggregate.errors.push(...result.errors);

    options?.onProgress?.({
      processedSessions: aggregate.messages.processedSessions,
      totalSessions: aggregate.messages.totalSessions,
      syncedMessages: aggregate.messages.synced,
      syncedSessions: aggregate.sessions.synced,
      updatedSessions: aggregate.sessions.updated,
    });

    hasMore = Boolean(result.messages.hasMore);
    const nextCursor = result.messages.nextCursor;
    if (hasMore) {
      if (typeof nextCursor !== 'number' || nextCursor <= cursor) {
        aggregate.errors.push(`Invalid nextCursor from sync API: ${String(nextCursor)} (current: ${cursor})`);
        break;
      }
      cursor = nextCursor;
    }

    if (!hasMore) {
      break;
    }
  }

  return aggregate;
}

/**
 * 獲取所有會話
 */
export function useSessions(provider: SessionProvider = 'claude') {
  return useQuery<Session[]>({
    queryKey: ['sessions', provider],
    queryFn: () => sessionsApi.getAll(provider),
  });
}

/**
 * 按日期分組獲取會話
 */
export function useSessionsByDate(provider: SessionProvider = 'claude') {
  return useQuery<SessionGroup[]>({
    queryKey: ['sessions', provider, 'by-date'],
    queryFn: () => sessionsApi.getByDate(provider),
  });
}

/**
 * 獲取單個會話
 */
export function useSession(sessionId: string | null, provider: SessionProvider = 'claude') {
  return useQuery<Session>({
    queryKey: ['sessions', provider, sessionId],
    queryFn: () => sessionsApi.getById(sessionId!, provider),
    enabled: !!sessionId,
  });
}

/**
 * 獲取統計信息
 */
export function useStats(provider: SessionProvider = 'claude') {
  return useQuery({
    queryKey: ['stats', provider],
    queryFn: () => sessionsApi.getStats(provider),
  });
}

/**
 * 同步會話
 */
export function useSyncSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: { provider?: SessionProvider; batchSize?: number; onProgress?: (progress: SyncBatchProgress) => void }) =>
      syncAllInBatches(options),
    onSuccess: (_data, variables) => {
      const provider = variables?.provider ?? 'claude';
      // 同步成功後刷新會話列表
      queryClient.invalidateQueries({ queryKey: ['sessions', provider] });
      queryClient.invalidateQueries({ queryKey: ['stats', provider] });
    },
  });
}

/**
 * 導出會話
 */
export function useExportSession() {
  return useMutation({
    mutationFn: async ({ sessionId, provider = 'claude', format }: { sessionId: string; provider?: SessionProvider; format: 'json' | 'md' }) => {
      if (format === 'json') {
        return exportApi.exportSession(sessionId, provider);
      } else {
        return exportApi.exportSessionAsMarkdown(sessionId, provider);
      }
    },
  });
}
