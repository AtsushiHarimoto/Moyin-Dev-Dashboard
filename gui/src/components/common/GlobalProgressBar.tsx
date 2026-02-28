import { useEffect } from 'react';
import { useAnalysisStore, selectIsRunning } from '../../stores/useAnalysisStore';

const STEP_LABELS: Record<string, string> = {
  starting: '初始化中...',
  step_1_scraping: '爬取 AI 趨勢數據',
  step_2_auditing: 'AI 審計分析',
  step_3_reporting: '生成報告',
  completed: '分析完成',
  cancelled: '已取消',
  failed: '分析失敗',
};

export function GlobalProgressBar() {
  const { currentJob, subscribe, unsubscribe, cancel } = useAnalysisStore();
  const isRunning = useAnalysisStore(selectIsRunning);

  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  if (!currentJob) return null;

  const isTerminal = !isRunning;
  const isError = currentJob.status === 'failed';
  const isSuccess = currentJob.status === 'completed';

  return (
    <div className="fixed top-0 left-0 right-0 z-50" style={{ height: '36px' }}>
      <div
        className="h-full flex items-center px-4 gap-3"
        style={{
          background: isError
            ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.9), rgba(127, 29, 29, 0.9))'
            : isSuccess
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))'
              : 'var(--color-surface-dark)',
          borderBottom: '1px solid var(--color-glass-border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {!isTerminal && (
          <div
            className="h-1 rounded-full overflow-hidden flex-shrink-0"
            style={{ width: '120px', background: 'color-mix(in srgb, var(--color-sakura-pink) 20%, transparent)' }}
            role="progressbar"
            aria-valuenow={currentJob.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${currentJob.progress}%`,
                background: 'var(--color-sakura-gradient)',
                boxShadow: '0 0 8px var(--color-sakura-glow)',
              }}
            />
          </div>
        )}

        <span className="text-xs font-medium truncate" style={{ color: 'var(--color-moonlight)' }}>
          {!isTerminal && `Step ${currentJob.step}/${currentJob.totalSteps}: `}
          {STEP_LABELS[currentJob.status] ?? currentJob.message}
        </span>

        <div className="flex-1" />

        {!isTerminal && (
          <button
            type="button"
            onClick={cancel}
            className="text-xs px-2 py-0.5 rounded-full transition-colors hover:bg-white/10"
            style={{ color: 'var(--color-morning-mist)' }}
            title="取消分析"
            aria-label="取消分析"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
