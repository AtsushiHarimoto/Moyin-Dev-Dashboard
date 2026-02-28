import { create } from 'zustand';
import type { AnalysisEvent } from '../utils/api';
import { analysisApi } from '../utils/api';
import { queryClient } from '../lib/queryClient';
import { toast } from '../components/common/Toast';
import { tRaw } from '../i18n';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'failed']);

export interface BatchProgress {
  batchId: number;
  total: number;
  current: number;
  currentLabel: string;
  status: 'running' | 'completed' | 'cancelled';
  results: Array<{ label: string; status: string; emailed: boolean }>;
}

interface AnalysisState {
  currentJob: AnalysisEvent | null;
  batchProgress: BatchProgress | null;
  eventSource: EventSource | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  subscribe: () => void;
  unsubscribe: () => void;
  cancel: () => Promise<void>;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>()((set, get) => ({
  currentJob: null,
  batchProgress: null,
  eventSource: null,
  reconnectTimer: null,
  reconnectAttempts: 0,

  subscribe: () => {
    const existing = get().eventSource;
    if (existing) return;

    const es = new EventSource('/api/analysis/status');

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress' && data.jobId === 'batch') {
          try {
            const batchData = JSON.parse(data.message);
            if (batchData.type === 'batch_progress') {
              set({ batchProgress: batchData });

              if (batchData.status === 'completed') {
                toast.success(tRaw('analysis.toast.batchCompleted'));
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ['reports'] });
                  queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
                }, 500);
                const snapshotId = batchData.batchId;
                setTimeout(() => {
                  const cur = get().batchProgress;
                  if (cur && cur.batchId === snapshotId && cur.status !== 'running') {
                    set({ batchProgress: null });
                  }
                }, 5000);
              } else if (batchData.status === 'cancelled') {
                toast.info(tRaw('analysis.toast.batchCancelled'));
                const snapshotId = batchData.batchId;
                setTimeout(() => {
                  const cur = get().batchProgress;
                  if (cur && cur.batchId === snapshotId && cur.status !== 'running') {
                    set({ batchProgress: null });
                  }
                }, 3000);
              }
              return;
            }
          } catch (e) { console.debug('SSE batch parse error:', e); }
        }
        if (data.type === 'progress') {
          const { type, ...analysisEvent } = data;
          set({ currentJob: analysisEvent as AnalysisEvent });

          if (TERMINAL_STATUSES.has(data.status)) {
            // 通知用戶並刷新報告數據
            if (data.status === 'completed') {
              toast.success(tRaw('analysis.toast.completed'));
              // 延遲 500ms 再刷新，確保檔案系統完全 flush（Windows 尤其需要）
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['reports'] });
                queryClient.invalidateQueries({ queryKey: ['analysis-reports'] });
                queryClient.invalidateQueries({ queryKey: ['analysis-insights'] });
              }, 500);
            } else if (data.status === 'failed') {
              toast.error(tRaw('analysis.toast.failed', { message: data.message || tRaw('analysis.toast.unknownError') }));
            } else if (data.status === 'cancelled') {
              toast.info(tRaw('analysis.toast.cancelled'));
            }

            const delay = data.status === 'completed' ? 3000 : 8000;
            const jobIdAtSchedule = data.jobId;
            setTimeout(() => {
              const current = get().currentJob;
              if (current && current.jobId === jobIdAtSchedule && TERMINAL_STATUSES.has(current.status)) {
                set({ currentJob: null });
              }
            }, delay);
          }
        }
      } catch (e) { console.debug('SSE parse error:', e); }
    };

    es.onopen = () => {
      set({ reconnectAttempts: 0 });
    };

    es.onerror = () => {
      es.close();
      const attempts = get().reconnectAttempts;
      if (attempts >= 10) {
        console.warn('[SSE] Max reconnect attempts reached, giving up');
        set({ eventSource: null, reconnectAttempts: 0 });
        return;
      }
      const delay = Math.min(3000 * Math.pow(2, attempts), 60000);
      const timer = setTimeout(() => {
        if (!get().eventSource) get().subscribe();
      }, delay);
      set({ eventSource: null, reconnectTimer: timer, reconnectAttempts: attempts + 1 });
    };

    set({ eventSource: es });
  },

  unsubscribe: () => {
    const timer = get().reconnectTimer;
    if (timer) clearTimeout(timer);
    const es = get().eventSource;
    if (es) {
      es.close();
      set({ eventSource: null, reconnectTimer: null });
    }
  },

  cancel: async () => {
    try { await analysisApi.cancel(); } catch (e) { console.debug('Analysis cancel error:', e); }
  },

  reset: () => {
    set({ currentJob: null });
  },
}));

export const selectIsRunning = (state: AnalysisState): boolean =>
  state.currentJob !== null && !TERMINAL_STATUSES.has(state.currentJob.status);
