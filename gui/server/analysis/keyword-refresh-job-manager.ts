import crypto from 'crypto';
import type { KeywordRefreshErrorType } from './keyword-presets';

export type KeywordRefreshJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface CategoryFailure {
  category: string;
  error: string;
  errorType: KeywordRefreshErrorType;
}

export interface KeywordRefreshJob {
  id: string;
  status: KeywordRefreshJobStatus;
  useAi: boolean;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  progress: number;
  currentCategory: string | null;
  message: string;
  error: string | null;
  failedCategories: CategoryFailure[];
  deadlineMs: number | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface StartKeywordRefreshResult {
  job: KeywordRefreshJob;
  existing: boolean;
  parameterMismatch?: boolean;
}

class KeywordRefreshJobManager {
  private currentJobId: string | null = null;
  private latestJobId: string | null = null;
  private jobs = new Map<string, KeywordRefreshJob>();
  private readonly maxJobs = 20;
  // Max job duration: 25 minutes (6 presets × 180s per-call + overhead)
  private readonly maxJobDurationMs = 25 * 60_000;

  private isTerminal(status: KeywordRefreshJobStatus): boolean {
    return status === 'completed' || status === 'failed';
  }

  getActiveJob(): KeywordRefreshJob | null {
    if (!this.currentJobId) return null;
    const job = this.jobs.get(this.currentJobId) ?? null;
    // Auto-fail stale jobs that exceeded dynamic deadline or fixed max duration
    if (job && !this.isTerminal(job.status)) {
      const now = Date.now();
      const exceeded = job.deadlineMs
        ? now > job.deadlineMs
        : (now - Date.parse(job.startedAt)) > this.maxJobDurationMs;
      if (exceeded) {
        this.fail(this.currentJobId, '超時：刷新任務超過最大時限');
        return null;
      }
    }
    return job;
  }

  getLatestJob(): KeywordRefreshJob | null {
    if (!this.latestJobId) return null;
    return this.jobs.get(this.latestJobId) ?? null;
  }

  getCurrentOrLatest(): KeywordRefreshJob | null {
    return this.getActiveJob() ?? this.getLatestJob();
  }

  getJob(id: string): KeywordRefreshJob | null {
    return this.jobs.get(id) ?? null;
  }

  startOrReuse(useAi: boolean): StartKeywordRefreshResult {
    const active = this.getActiveJob();
    if (active && !this.isTerminal(active.status)) {
      const mismatch = active.useAi !== useAi;
      if (mismatch) {
        console.warn(`[keyword-refresh] Active job uses useAi=${active.useAi}, requested useAi=${useAi} — reusing existing job`);
      }
      return { job: active, existing: true, parameterMismatch: mismatch || undefined };
    }

    const now = new Date().toISOString();
    const job: KeywordRefreshJob = {
      id: crypto.randomUUID(),
      status: 'queued',
      useAi,
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      progress: 0,
      currentCategory: null,
      message: '等待開始刷新熱詞...',
      error: null,
      failedCategories: [],
      deadlineMs: null,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
    };

    this.jobs.set(job.id, job);
    this.currentJobId = job.id;
    this.latestJobId = job.id;
    this.trimHistory();
    return { job, existing: false };
  }

  markRunning(jobId: string, message = '正在初始化熱詞刷新...'): void {
    this.patch(jobId, {
      status: 'running',
      message,
      error: null,
    });
  }

  /** Set a dynamic deadline based on the number of presets and per-call timeout */
  setDeadline(jobId: string, totalPresets: number, perCallTimeoutMs: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.deadlineMs = Date.now() + totalPresets * perCallTimeoutMs + 120_000;
  }

  applyProgress(jobId: string, patch: Partial<KeywordRefreshJob>): void {
    this.patch(jobId, patch);
  }

  complete(jobId: string, message = '熱詞刷新完成'): void {
    this.patch(jobId, {
      status: 'completed',
      currentCategory: null,
      progress: 100,
      message,
    });
  }

  addFailedCategory(jobId: string, failure: CategoryFailure): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.failedCategories.push(failure);
    job.updatedAt = new Date().toISOString();
  }

  fail(jobId: string, error: string): void {
    this.patch(jobId, {
      status: 'failed',
      currentCategory: null,
      message: `熱詞刷新失敗：${error}`,
      error,
    });
  }

  private patch(jobId: string, patch: Partial<KeywordRefreshJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (job as Record<string, unknown>)[key] = value;
      }
    }
    const now = new Date().toISOString();
    job.updatedAt = now;
    if (this.isTerminal(job.status)) {
      job.completedAt = now;
      if (this.currentJobId === jobId) this.currentJobId = null;
    }
  }

  private trimHistory(): void {
    const overflow = this.jobs.size - this.maxJobs;
    if (overflow <= 0) return;

    const protectedIds = new Set<string>();
    if (this.currentJobId) protectedIds.add(this.currentJobId);
    if (this.latestJobId) protectedIds.add(this.latestJobId);

    const entries = Array.from(this.jobs.entries())
      .sort((a, b) => a[1].updatedAt.localeCompare(b[1].updatedAt));

    let removed = 0;
    for (const [id] of entries) {
      if (removed >= overflow) break;
      if (protectedIds.has(id)) continue;
      this.jobs.delete(id);
      removed += 1;
    }
  }
}

export const keywordRefreshJobManager = new KeywordRefreshJobManager();
