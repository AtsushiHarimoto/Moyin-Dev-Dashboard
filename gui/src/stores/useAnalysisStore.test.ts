import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock queryClient before importing the store
vi.mock('../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

// Mock toast before importing the store
vi.mock('../components/common/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock analysisApi
vi.mock('../utils/api', () => ({
  analysisApi: {
    cancel: vi.fn(),
  },
}));

// Mock tRaw — 回傳 zh-TW 翻譯，確保測試與語系無關
vi.mock('../i18n', () => {
  const zhTW: Record<string, string> = {
    'analysis.toast.completed': '分析完成！報告已生成。',
    'analysis.toast.failed': '分析失敗：{{message}}',
    'analysis.toast.cancelled': '分析已取消',
    'analysis.toast.unknownError': '未知錯誤',
  };
  return {
    tRaw: (key: string, params?: Record<string, string | number>) => {
      let tpl = zhTW[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          tpl = tpl.split(`{{${k}}}`).join(String(v));
        }
      }
      return tpl;
    },
  };
});

import { useAnalysisStore, selectIsRunning } from './useAnalysisStore';
import { queryClient } from '../lib/queryClient';
import { toast } from '../components/common/Toast';
import { analysisApi } from '../utils/api';

// Capture the actual EventSource instance created by the store
let capturedES: any = null;

function installMockEventSource() {
  const MockES = vi.fn(function (this: any) {
    this.onmessage = null;
    this.onerror = null;
    this.close = vi.fn();
    capturedES = this;
  }) as unknown as typeof EventSource;

  vi.stubGlobal('EventSource', MockES);
  return MockES;
}

describe('useAnalysisStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    capturedES = null;
    useAnalysisStore.setState({ currentJob: null, eventSource: null, reconnectTimer: null, reconnectAttempts: 0 });
  });

  afterEach(() => {
    useAnalysisStore.getState().unsubscribe();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function setupSSE() {
    installMockEventSource();
    useAnalysisStore.getState().subscribe();
    return capturedES;
  }

  function sendEvent(data: Record<string, unknown>) {
    capturedES.onmessage({ data: JSON.stringify({ type: 'progress', ...data }) });
  }

  describe('completion notifications', () => {
    it('should show success toast and invalidate queries on completed', () => {
      setupSSE();

      sendEvent({
        status: 'completed',
        jobId: 'job-1',
        step: 3,
        message: '分析完成',
        progress: 100,
      });

      expect(toast.success).toHaveBeenCalledWith('分析完成！報告已生成。');

      // invalidation is delayed 500ms to allow filesystem flush
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
      vi.advanceTimersByTime(500);
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reports'] });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['analysis-reports'] });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['analysis-insights'] });
    });

    it('should show error toast on failed', () => {
      setupSSE();

      sendEvent({
        status: 'failed',
        jobId: 'job-2',
        step: 1,
        message: 'Connection timeout',
        progress: 10,
      });

      expect(toast.error).toHaveBeenCalledWith('分析失敗：Connection timeout');
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    });

    it('should show error toast with fallback message on failed without message', () => {
      setupSSE();

      sendEvent({
        status: 'failed',
        jobId: 'job-2b',
        step: 1,
        progress: 10,
      });

      expect(toast.error).toHaveBeenCalledWith('分析失敗：未知錯誤');
    });

    it('should show info toast on cancelled', () => {
      setupSSE();

      sendEvent({
        status: 'cancelled',
        jobId: 'job-3',
        step: 2,
        message: '已取消',
        progress: 50,
      });

      expect(toast.info).toHaveBeenCalledWith('分析已取消');
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    });

    it('should clear currentJob after 3s delay on completed', () => {
      setupSSE();

      sendEvent({
        status: 'completed',
        jobId: 'job-4',
        step: 3,
        message: '完成',
        progress: 100,
      });

      expect(useAnalysisStore.getState().currentJob).not.toBeNull();
      expect(useAnalysisStore.getState().currentJob?.jobId).toBe('job-4');

      vi.advanceTimersByTime(3000);
      expect(useAnalysisStore.getState().currentJob).toBeNull();
    });

    it('should clear currentJob after 8s delay on failed', () => {
      setupSSE();

      sendEvent({
        status: 'failed',
        jobId: 'job-5',
        step: 1,
        message: 'err',
        progress: 0,
      });

      vi.advanceTimersByTime(7999);
      expect(useAnalysisStore.getState().currentJob).not.toBeNull();

      vi.advanceTimersByTime(1);
      expect(useAnalysisStore.getState().currentJob).toBeNull();
    });
  });

  describe('selectIsRunning', () => {
    it('returns false when no job', () => {
      expect(selectIsRunning(useAnalysisStore.getState())).toBe(false);
    });

    it('returns true for in-progress job', () => {
      useAnalysisStore.setState({
        currentJob: {
          status: 'step_1_scraping',
          jobId: 'j1',
          step: 1,
          message: 'scraping',
          progress: 10,
        } as any,
      });
      expect(selectIsRunning(useAnalysisStore.getState())).toBe(true);
    });

    it('returns false for completed job', () => {
      useAnalysisStore.setState({
        currentJob: {
          status: 'completed',
          jobId: 'j2',
          step: 3,
          message: 'done',
          progress: 100,
        } as any,
      });
      expect(selectIsRunning(useAnalysisStore.getState())).toBe(false);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should not create duplicate EventSource', () => {
      const MockES = installMockEventSource();

      useAnalysisStore.getState().subscribe();
      useAnalysisStore.getState().subscribe();

      expect(MockES).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe closes EventSource', () => {
      setupSSE();
      const es = capturedES;

      useAnalysisStore.getState().unsubscribe();

      expect(es.close).toHaveBeenCalled();
      expect(useAnalysisStore.getState().eventSource).toBeNull();
    });
  });

  describe('message handling edge cases', () => {
    it('ignores non-progress messages', () => {
      setupSSE();

      capturedES.onmessage({ data: JSON.stringify({ type: 'heartbeat' }) });

      expect(useAnalysisStore.getState().currentJob).toBeNull();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('ignores invalid JSON', () => {
      setupSSE();

      capturedES.onmessage({ data: 'not json' });

      expect(useAnalysisStore.getState().currentJob).toBeNull();
    });

    it('updates currentJob for in-progress status without toast', () => {
      setupSSE();

      sendEvent({
        status: 'step_2_auditing',
        jobId: 'job-6',
        step: 2,
        message: '審計中',
        progress: 50,
      });

      expect(useAnalysisStore.getState().currentJob?.status).toBe('step_2_auditing');
      expect(useAnalysisStore.getState().currentJob?.progress).toBe(50);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  // ==================== T-2：SSE 重連測試 ====================
  describe('SSE reconnect', () => {
    it('onerror 觸發延遲後重連', () => {
      const MockES = installMockEventSource();
      useAnalysisStore.getState().subscribe();
      const firstES = capturedES;

      // 觸發 onerror → 應關閉舊連線並排程重連
      firstES.onerror();

      expect(firstES.close).toHaveBeenCalled();
      expect(useAnalysisStore.getState().eventSource).toBeNull();
      expect(useAnalysisStore.getState().reconnectAttempts).toBe(1);

      // 第一次重連延遲 = min(3000 * 2^0, 60000) = 3000ms
      vi.advanceTimersByTime(2999);
      // 尚未重連
      expect(MockES).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      // 重連觸發 → 建立新 EventSource
      expect(MockES).toHaveBeenCalledTimes(2);
    });

    it('達到最大重連次數（10 次）後停止重試', () => {
      const MockES = installMockEventSource();
      useAnalysisStore.getState().subscribe(); // ES #1, attempts=0

      // 連續觸發 onerror + 推進 timer 讓重連發生，共 10 輪
      // 每輪：onerror → attempts++ → timer → subscribe → 新 ES
      for (let i = 0; i < 10; i++) {
        const es = capturedES;
        es.onerror();
        const delay = Math.min(3000 * Math.pow(2, i), 60000);
        vi.advanceTimersByTime(delay);
      }
      // 此時 attempts=10，且剛建立了 ES #11

      // 第 11 次 onerror：attempts=10 >= 10 → 放棄並歸零
      capturedES.onerror();

      expect(useAnalysisStore.getState().reconnectAttempts).toBe(0);
      expect(useAnalysisStore.getState().eventSource).toBeNull();

      // 不管再等多久都不會再建立新的 EventSource
      vi.advanceTimersByTime(120000);
      // 初始 1 次 + 10 次重連 = 共 11 次建構
      expect(MockES).toHaveBeenCalledTimes(11);
    });

    it('onopen 重設重連嘗試次數', () => {
      installMockEventSource();
      useAnalysisStore.getState().subscribe();
      const firstES = capturedES;

      // 觸發一次 onerror → reconnectAttempts 變成 1
      firstES.onerror();
      expect(useAnalysisStore.getState().reconnectAttempts).toBe(1);

      // 讓 timer 觸發重連
      vi.advanceTimersByTime(3000);
      const secondES = capturedES;
      expect(secondES).not.toBe(firstES);

      // 新連線的 onopen 觸發 → 應重設 reconnectAttempts
      secondES.onopen();
      expect(useAnalysisStore.getState().reconnectAttempts).toBe(0);
    });
  });

  // ==================== T-3：cancel() 與 reset() 動作測試 ====================
  describe('cancel and reset actions', () => {
    it('cancel() 呼叫 analysisApi.cancel()', async () => {
      (analysisApi.cancel as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        jobId: 'j1',
        status: 'cancelled',
      });

      await useAnalysisStore.getState().cancel();

      expect(analysisApi.cancel).toHaveBeenCalled();
    });

    it('reset() 將 currentJob 設為 null', () => {
      // 先設定一個進行中的 currentJob
      useAnalysisStore.setState({
        currentJob: {
          status: 'step_1_scraping',
          jobId: 'j-reset',
          step: 1,
          message: 'running',
          progress: 20,
        } as any,
      });

      expect(useAnalysisStore.getState().currentJob).not.toBeNull();

      useAnalysisStore.getState().reset();

      expect(useAnalysisStore.getState().currentJob).toBeNull();
    });
  });
});
