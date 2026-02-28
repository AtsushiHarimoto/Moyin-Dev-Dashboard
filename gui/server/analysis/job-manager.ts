import crypto from 'crypto';
import { getAnalysisDatabase } from '../database';
import type { TrendItem } from './runner';

export type AnalysisStatus =
  | 'starting'
  | 'step_1_scraping'
  | 'step_2_auditing'
  | 'step_3_reporting'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface AnalysisEvent {
  jobId: string;
  status: AnalysisStatus;
  step: number;
  totalSteps: number;
  message: string;
  progress: number;
  timestamp: string;
}

export interface AnalysisJob {
  id: string;
  keywords: string;
  days: number;
  label: string;
  status: AnalysisStatus;
  cancelRequested: boolean;
}

export interface BatchPreset {
  label: string;
  keywords: string;
  days: number;
}

export interface BatchItemResult {
  label: string;
  status: 'completed' | 'failed';
  emailed: boolean;
}

export interface BatchProgress {
  batchId: number;
  total: number;
  current: number;
  currentLabel: string;
  status: 'running' | 'completed' | 'cancelled';
  results: BatchItemResult[];
}

type SSEClient = (event: AnalysisEvent) => void;

class JobManager {
  private static readonly MAX_CLIENTS = 50;
  private currentJob: AnalysisJob | null = null;
  private sseClients: Set<SSEClient> = new Set();
  private _batchQueue: BatchPreset[] = [];
  private _batchProgress: BatchProgress | null = null;
  private _batchCancelRequested = false;
  private _batchIdCounter = 0;

  get isRunning(): boolean {
    return this.currentJob !== null && !this.isTerminal(this.currentJob.status);
  }

  get activeJobId(): string | null {
    return this.currentJob?.id ?? null;
  }

  get isBatchRunning(): boolean {
    return this._batchProgress !== null && this._batchProgress.status === 'running';
  }

  get batchProgress(): BatchProgress | null {
    return this._batchProgress;
  }

  get isBatchCancelRequested(): boolean {
    return this._batchCancelRequested;
  }

  isTerminal(status: AnalysisStatus): boolean {
    return status === 'completed' || status === 'cancelled' || status === 'failed';
  }

  createJob(keywords: string, days: number, label: string = '', _batchInternal = false): AnalysisJob {
    if (this.isRunning) {
      throw new Error('ANALYSIS_RUNNING');
    }
    if (!_batchInternal && this.isBatchRunning) throw new Error('BATCH_RUNNING');

    const job: AnalysisJob = {
      id: crypto.randomUUID(),
      keywords,
      days,
      label,
      status: 'starting',
      cancelRequested: false,
    };

    this.currentJob = job;

    const db = getAnalysisDatabase();
    db.prepare(`
      INSERT INTO analysis_jobs (id, status, keywords, days, started_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(job.id, job.status, keywords, days);

    this.emit({
      jobId: job.id,
      status: 'starting',
      step: 0,
      totalSteps: 3,
      message: '正在初始化分析...',
      progress: 0,
      timestamp: new Date().toISOString(),
    });

    return job;
  }

  updateStatus(status: AnalysisStatus, step: number, message: string, progress: number): void {
    if (!this.currentJob) return;
    this.currentJob.status = status;

    const completedAt = this.isTerminal(status) ? new Date().toISOString() : null;
    const db = getAnalysisDatabase();
    db.prepare(`UPDATE analysis_jobs SET status = ?, completed_at = ? WHERE id = ?`)
      .run(status, completedAt, this.currentJob.id);

    this.emit({
      jobId: this.currentJob.id,
      status,
      step,
      totalSteps: 3,
      message,
      progress,
      timestamp: new Date().toISOString(),
    });

    if (this.isTerminal(status)) {
      this.currentJob = null;
    }
  }

  updateJobData(data: { scrapeCount?: number; auditCount?: number; reportMd?: string; insightsJson?: string }): void {
    if (!this.currentJob) return;
    const db = getAnalysisDatabase();
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.scrapeCount !== undefined) { sets.push('scrape_count = ?'); vals.push(data.scrapeCount); }
    if (data.auditCount !== undefined) { sets.push('audit_count = ?'); vals.push(data.auditCount); }
    if (data.reportMd !== undefined) { sets.push('report_md = ?'); vals.push(data.reportMd); }
    if (data.insightsJson !== undefined) { sets.push('insights_json = ?'); vals.push(data.insightsJson); }
    if (sets.length === 0) return;
    vals.push(this.currentJob.id);
    db.prepare(`UPDATE analysis_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  requestCancel(): string | null {
    if (!this.currentJob || this.isTerminal(this.currentJob.status)) return null;
    this.currentJob.cancelRequested = true;
    return this.currentJob.id;
  }

  isCancelRequested(): boolean {
    return this.currentJob?.cancelRequested ?? false;
  }

  failJob(errorMessage: string): void {
    if (!this.currentJob) return;
    const db = getAnalysisDatabase();
    db.prepare(`UPDATE analysis_jobs SET error_message = ? WHERE id = ?`)
      .run(errorMessage, this.currentJob.id);
    this.updateStatus('failed', 0, `分析失敗: ${errorMessage}`, 0);
  }

  addClient(client: SSEClient): boolean {
    if (this.sseClients.size >= JobManager.MAX_CLIENTS) {
      return false;
    }
    this.sseClients.add(client);
    return true;
  }

  removeClient(client: SSEClient): void {
    this.sseClients.delete(client);
  }

  private emit(event: AnalysisEvent): void {
    for (const client of this.sseClients) {
      try { client(event); } catch { this.sseClients.delete(client); }
    }
  }

  startBatch(presets: BatchPreset[]): void {
    if (this.isRunning) throw new Error('ANALYSIS_RUNNING');
    if (this.isBatchRunning) throw new Error('BATCH_RUNNING');

    this._batchQueue = [...presets];
    this._batchCancelRequested = false;
    this._batchIdCounter += 1;
    this._batchProgress = {
      batchId: this._batchIdCounter,
      total: presets.length,
      current: 0,
      currentLabel: '',
      status: 'running',
      results: [],
    };
    this.emitBatch();
  }

  advanceBatch(): BatchPreset | null {
    if (!this._batchProgress || this._batchQueue.length === 0) {
      if (this._batchProgress) {
        this._batchProgress.status = 'completed';
        this._batchProgress.currentLabel = '';
        this.emitBatch();
        this._batchProgress = null;
      }
      return null;
    }
    const next = this._batchQueue.shift()!;
    this._batchProgress.current += 1;
    this._batchProgress.currentLabel = next.label;
    this.emitBatch();
    return next;
  }

  completeBatchItem(label: string, emailed: boolean): void {
    if (!this._batchProgress) return;
    this._batchProgress.results.push({ label, status: 'completed', emailed });
    this.emitBatch();
  }

  failBatchItem(label: string): void {
    if (!this._batchProgress) return;
    this._batchProgress.results.push({ label, status: 'failed', emailed: false });
    this.emitBatch();
  }

  cancelBatch(): void {
    this._batchCancelRequested = true;
    this._batchQueue = [];
    if (this._batchProgress) {
      this._batchProgress.status = 'cancelled';
      this._batchProgress.currentLabel = '';
      this.emitBatch();
      this._batchProgress = null;
    }
    this._batchCancelRequested = false;
    this.requestCancel();
  }

  private emitBatch(): void {
    if (!this._batchProgress) return;
    for (const client of this.sseClients) {
      try {
        client({
          jobId: 'batch',
          status: 'starting',
          step: this._batchProgress.current,
          totalSteps: this._batchProgress.total,
          message: JSON.stringify({ type: 'batch_progress', ...this._batchProgress }),
          progress: Math.round((this._batchProgress.current / this._batchProgress.total) * 100),
          timestamp: new Date().toISOString(),
        });
      } catch { this.sseClients.delete(client); }
    }
  }

  getLatestJobs(limit = 20): unknown[] {
    const db = getAnalysisDatabase();
    return db.prepare(`SELECT * FROM analysis_jobs ORDER BY created_at DESC LIMIT ?`).all(limit);
  }

  getLatestInsights(): {
    reportDate: string;
    summary: string;
    adopt: string[];
    trial: string[];
    assess: string[];
    hold: string[];
    items: TrendItem[];
  } | null {
    const db = getAnalysisDatabase();
    const row = db.prepare(`
      SELECT insights_json, created_at FROM analysis_jobs
      WHERE status = 'completed' AND insights_json IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `).get() as { insights_json: string; created_at: string } | undefined;
    if (!row) return null;
    try {
      const insights = JSON.parse(row.insights_json);
      // Ensure backward compatibility: fill missing fields with defaults
      return {
        reportDate: row.created_at,
        summary: insights.summary ?? '',
        adopt: insights.adopt ?? [],
        trial: insights.trial ?? [],
        assess: insights.assess ?? [],
        hold: insights.hold ?? [],
        items: insights.items ?? [],
      };
    } catch {
      return null;
    }
  }
}

export const jobManager = new JobManager();
