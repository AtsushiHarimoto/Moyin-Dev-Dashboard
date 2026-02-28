import { createHermitPurpleClient } from './mcp-client';
import { refreshFromHermitPurple, getAllPresets, KEYWORD_REFRESH_PER_CALL_TIMEOUT_MS } from './keyword-presets';
import { keywordRefreshJobManager, type StartKeywordRefreshResult } from './keyword-refresh-job-manager';

function toProgress(total: number, completed: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

export function startKeywordRefreshJob(useAi = true): StartKeywordRefreshResult {
  const result = keywordRefreshJobManager.startOrReuse(useAi);
  if (!result.existing) {
    void runKeywordRefreshJob(result.job.id, useAi).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[keyword-refresh] Unhandled background error:', err);
      keywordRefreshJobManager.fail(result.job.id, msg);
    });
  }
  return result;
}

async function runKeywordRefreshJob(jobId: string, useAi: boolean): Promise<void> {
  keywordRefreshJobManager.markRunning(jobId);

  // Set dynamic deadline based on preset count
  const presetCount = getAllPresets().length;
  keywordRefreshJobManager.setDeadline(jobId, presetCount, KEYWORD_REFRESH_PER_CALL_TIMEOUT_MS);

  const { client, transport } = await createHermitPurpleClient();

  try {
    await refreshFromHermitPurple(client, useAi, {
      onProgress: (event) => {
        keywordRefreshJobManager.applyProgress(jobId, {
          total: event.total,
          completed: event.completed,
          succeeded: event.succeeded,
          failed: event.failed,
          progress: toProgress(event.total, event.completed),
          currentCategory: event.stage === 'preset_start' ? (event.category ?? null) : null,
          message: event.message,
          error: event.error ?? null,
        });
        // 記錄每個分類的失敗詳情
        if (event.stage === 'preset_failed' && event.category && event.error) {
          keywordRefreshJobManager.addFailedCategory(jobId, {
            category: event.category,
            error: event.error,
            errorType: event.errorType ?? 'unknown',
          });
        }
      },
    });

    const finalJob = keywordRefreshJobManager.getJob(jobId);
    const suffix = finalJob ? `（成功 ${finalJob.succeeded} / 失敗 ${finalJob.failed}）` : '';
    if (finalJob && finalJob.succeeded === 0 && finalJob.failed > 0) {
      keywordRefreshJobManager.fail(jobId, `全部 ${finalJob.failed} 個分類刷新失敗`);
    } else {
      keywordRefreshJobManager.complete(jobId, `熱詞刷新完成${suffix}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    keywordRefreshJobManager.fail(jobId, msg);
  } finally {
    try {
      await transport.close();
    } catch {
      // ignore close errors; job status already finalized
    }
  }
}
