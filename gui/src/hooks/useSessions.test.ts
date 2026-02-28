import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncAllInBatches } from './useSessions';
import { syncApi } from '../utils/api';

describe('syncAllInBatches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('aggregates multi-batch sync results and reports progress', async () => {
    const syncSpy = vi.spyOn(syncApi, 'syncAll');
    syncSpy
      .mockResolvedValueOnce({
        sessions: { synced: 1, updated: 2 },
        messages: {
          synced: 100,
          processedSessions: 10,
          totalSessions: 24,
          hasMore: true,
          nextCursor: 10,
        },
        errors: [],
      })
      .mockResolvedValueOnce({
        sessions: { synced: 0, updated: 1 },
        messages: {
          synced: 80,
          processedSessions: 20,
          totalSessions: 24,
          hasMore: true,
          nextCursor: 20,
        },
        errors: ['e1'],
      })
      .mockResolvedValueOnce({
        sessions: { synced: 0, updated: 0 },
        messages: {
          synced: 30,
          processedSessions: 24,
          totalSessions: 24,
          hasMore: false,
          nextCursor: null,
        },
        errors: [],
      });

    const progress: Array<{ processedSessions: number; totalSessions: number; syncedMessages: number }> = [];
    const result = await syncAllInBatches({
      batchSize: 10,
      onProgress: (p) => progress.push(p),
    });

    expect(syncSpy).toHaveBeenCalledTimes(3);
    expect(syncSpy).toHaveBeenNthCalledWith(1, 'claude', { cursor: 0, batchSize: 10 });
    expect(syncSpy).toHaveBeenNthCalledWith(2, 'claude', { cursor: 10, batchSize: 10 });
    expect(syncSpy).toHaveBeenNthCalledWith(3, 'claude', { cursor: 20, batchSize: 10 });

    expect(result.sessions).toEqual({ synced: 1, updated: 3 });
    expect(result.messages.synced).toBe(210);
    expect(result.messages.totalSessions).toBe(24);
    expect(result.errors).toEqual(['e1']);
    expect(progress[progress.length - 1]).toMatchObject({
      processedSessions: 24,
      totalSessions: 24,
      syncedMessages: 210,
    });
  });

  it('stops safely when hasMore=true but nextCursor is invalid', async () => {
    const syncSpy = vi.spyOn(syncApi, 'syncAll');
    syncSpy.mockResolvedValueOnce({
      sessions: { synced: 1, updated: 0 },
      messages: {
        synced: 10,
        processedSessions: 5,
        totalSessions: 10,
        hasMore: true,
        nextCursor: 0,
      },
      errors: [],
    });

    const result = await syncAllInBatches({ batchSize: 5 });

    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(result.sessions).toEqual({ synced: 1, updated: 0 });
    expect(result.messages.synced).toBe(10);
    expect(result.errors).toContain('Invalid nextCursor from sync API: 0 (current: 0)');
  });
});

