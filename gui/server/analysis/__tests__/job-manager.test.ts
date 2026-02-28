import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module before importing JobManager
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);

vi.mock('../../database', () => ({
  getAnalysisDatabase: () => ({
    prepare: () => ({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    }),
  }),
}));

// Dynamic import so mock is in place
const { jobManager } = await import('../job-manager');

// We need a fresh JobManager for each test, but the module exports a singleton.
// To reset state between tests, we exploit the fact that completing/failing a job
// clears currentJob. We'll ensure each test starts clean.
beforeEach(() => {
  mockRun.mockReset();
  mockGet.mockReset();
  mockAll.mockReset().mockReturnValue([]);

  // Force-clear any leftover batch
  if (jobManager.isBatchRunning) {
    jobManager.cancelBatch();
  }

  // Force-clear any leftover job by failing it (safe even if no job is active)
  if (jobManager.isRunning) {
    jobManager.updateStatus('failed', 0, 'test reset', 0);
  }
});

describe('JobManager', () => {
  describe('createJob', () => {
    it('creates a job and emits "starting" event', () => {
      const client = vi.fn();
      jobManager.addClient(client);

      const job = jobManager.createJob('AI trends', 7);

      expect(job.status).toBe('starting');
      expect(job.keywords).toBe('AI trends');
      expect(job.days).toBe(7);
      expect(job.id).toBeTruthy();
      expect(mockRun).toHaveBeenCalled(); // DB insert
      expect(client).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: job.id,
          status: 'starting',
          step: 0,
          totalSteps: 3,
        }),
      );

      jobManager.removeClient(client);
      // Clean up
      jobManager.updateStatus('completed', 3, 'done', 100);
    });

    it('throws ANALYSIS_RUNNING if a job is already running', () => {
      const job = jobManager.createJob('test', 3);
      expect(job).toBeTruthy();

      expect(() => jobManager.createJob('test2', 5)).toThrow('ANALYSIS_RUNNING');

      // Clean up
      jobManager.updateStatus('failed', 0, 'cleanup', 0);
    });
  });

  describe('isRunning', () => {
    it('returns false when no job exists', () => {
      expect(jobManager.isRunning).toBe(false);
    });

    it('returns true when a job is active', () => {
      jobManager.createJob('kw', 1);
      expect(jobManager.isRunning).toBe(true);

      // Clean up
      jobManager.updateStatus('completed', 3, 'done', 100);
    });

    it('returns false after a terminal status', () => {
      jobManager.createJob('kw', 1);
      jobManager.updateStatus('completed', 3, 'done', 100);
      expect(jobManager.isRunning).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('transitions status and emits SSE event', () => {
      const client = vi.fn();
      jobManager.addClient(client);

      const job = jobManager.createJob('kw', 1);
      client.mockClear();

      jobManager.updateStatus('step_1_scraping', 1, 'Scraping...', 33);

      expect(client).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: job.id,
          status: 'step_1_scraping',
          step: 1,
          progress: 33,
        }),
      );

      jobManager.removeClient(client);
      jobManager.updateStatus('completed', 3, 'done', 100);
    });

    it('nullifies currentJob on terminal status', () => {
      jobManager.createJob('kw', 1);
      expect(jobManager.isRunning).toBe(true);

      jobManager.updateStatus('completed', 3, 'done', 100);
      expect(jobManager.isRunning).toBe(false);
      expect(jobManager.activeJobId).toBeNull();
    });
  });

  describe('requestCancel', () => {
    it('sets flag and returns jobId', () => {
      const job = jobManager.createJob('kw', 1);
      const result = jobManager.requestCancel();
      expect(result).toBe(job.id);
      expect(jobManager.isCancelRequested()).toBe(true);

      jobManager.updateStatus('cancelled', 0, 'cancelled', 0);
    });

    it('returns null if no active job', () => {
      expect(jobManager.requestCancel()).toBeNull();
    });
  });

  describe('isCancelRequested', () => {
    it('returns false when no job exists', () => {
      expect(jobManager.isCancelRequested()).toBe(false);
    });

    it('returns false when job exists but cancel not requested', () => {
      jobManager.createJob('kw', 1);
      expect(jobManager.isCancelRequested()).toBe(false);
      jobManager.updateStatus('completed', 3, 'done', 100);
    });

    it('returns true after requestCancel', () => {
      jobManager.createJob('kw', 1);
      jobManager.requestCancel();
      expect(jobManager.isCancelRequested()).toBe(true);
      jobManager.updateStatus('cancelled', 0, 'cancelled', 0);
    });
  });

  describe('failJob', () => {
    it('sets error message and transitions to failed', () => {
      const client = vi.fn();
      jobManager.addClient(client);

      jobManager.createJob('kw', 1);
      client.mockClear();
      mockRun.mockClear();

      jobManager.failJob('Something went wrong');

      // Should have called DB to set error_message, then updateStatus -> DB update
      expect(mockRun).toHaveBeenCalledWith('Something went wrong', expect.any(String));
      expect(client).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
        }),
      );
      expect(jobManager.isRunning).toBe(false);

      jobManager.removeClient(client);
    });
  });

  describe('addClient / removeClient', () => {
    it('manages SSE clients', () => {
      const client1 = vi.fn();
      const client2 = vi.fn();

      jobManager.addClient(client1);
      jobManager.addClient(client2);

      jobManager.createJob('kw', 1);

      expect(client1).toHaveBeenCalled();
      expect(client2).toHaveBeenCalled();

      jobManager.removeClient(client1);
      client1.mockClear();
      client2.mockClear();

      jobManager.updateStatus('step_1_scraping', 1, 'scraping', 33);

      expect(client1).not.toHaveBeenCalled();
      expect(client2).toHaveBeenCalled();

      jobManager.removeClient(client2);
      jobManager.updateStatus('completed', 3, 'done', 100);
    });
  });

  describe('dead client cleanup in emit', () => {
    it('removes client that throws on emit', () => {
      const badClient = vi.fn(() => {
        throw new Error('connection reset');
      });
      const goodClient = vi.fn();

      jobManager.addClient(badClient);
      jobManager.addClient(goodClient);

      jobManager.createJob('kw', 1);

      // badClient threw, so it should have been removed
      // goodClient should still receive events
      expect(goodClient).toHaveBeenCalled();

      goodClient.mockClear();
      badClient.mockClear();

      jobManager.updateStatus('step_1_scraping', 1, 'scraping', 33);

      // badClient should NOT be called again (was removed)
      expect(badClient).not.toHaveBeenCalled();
      expect(goodClient).toHaveBeenCalled();

      jobManager.removeClient(goodClient);
      jobManager.updateStatus('completed', 3, 'done', 100);
    });
  });

  describe('getLatestInsights', () => {
    it('returns null when no data', () => {
      mockGet.mockReturnValueOnce(undefined);
      const result = jobManager.getLatestInsights();
      expect(result).toBeNull();
    });

    it('parses valid insights_json', () => {
      const insights = { summary: 'AI is hot', adopt: ['MCP'], hold: ['X'], drop: ['Y'] };
      mockGet.mockReturnValueOnce({
        insights_json: JSON.stringify(insights),
        created_at: '2026-02-18T00:00:00Z',
      });

      const result = jobManager.getLatestInsights();
      expect(result).toEqual({
        reportDate: '2026-02-18T00:00:00Z',
        summary: 'AI is hot',
        adopt: ['MCP'],
        trial: [],
        assess: [],
        hold: ['X'],
        items: [],
      });
    });

    it('returns null when insights_json is invalid JSON', () => {
      mockGet.mockReturnValueOnce({
        insights_json: 'not valid json{{{',
        created_at: '2026-02-18T00:00:00Z',
      });

      const result = jobManager.getLatestInsights();
      expect(result).toBeNull();
    });
  });

  describe('Batch Queue', () => {
    it('isBatchRunning is false by default', () => {
      expect(jobManager.isBatchRunning).toBe(false);
    });

    it('startBatch sets batch state and emits batch_progress', () => {
      const client = vi.fn();
      jobManager.addClient(client);

      const presets = [
        { label: 'A', keywords: 'a', days: 7 },
        { label: 'B', keywords: 'b', days: 7 },
      ];
      jobManager.startBatch(presets);

      expect(jobManager.isBatchRunning).toBe(true);
      expect(jobManager.batchProgress).toEqual(
        expect.objectContaining({
          total: 2, current: 0, currentLabel: '', status: 'running', results: [],
        }),
      );
      expect(jobManager.batchProgress?.batchId).toBeGreaterThan(0);

      jobManager.removeClient(client);
      jobManager.cancelBatch();
    });

    it('prevents external single job while batch is running', () => {
      const presets = [{ label: 'A', keywords: 'a', days: 7 }];
      jobManager.startBatch(presets);
      // External call (no _batchInternal) should be blocked
      expect(() => jobManager.createJob('test', 3)).toThrow('BATCH_RUNNING');
      jobManager.cancelBatch();
    });

    it('allows internal batch job creation via _batchInternal flag', () => {
      const presets = [{ label: 'A', keywords: 'a', days: 7 }];
      jobManager.startBatch(presets);
      jobManager.advanceBatch();
      // Internal call (from batch runner) should succeed
      const job = jobManager.createJob('a', 7, 'A', true);
      expect(job.id).toBeTruthy();
      expect(job.keywords).toBe('a');
      // Clean up
      jobManager.updateStatus('completed', 3, 'done', 100);
      jobManager.cancelBatch();
    });

    it('prevents batch while single job is running', () => {
      jobManager.createJob('test', 3);
      const presets = [{ label: 'A', keywords: 'a', days: 7 }];
      expect(() => jobManager.startBatch(presets)).toThrow('ANALYSIS_RUNNING');
      jobManager.updateStatus('completed', 3, 'done', 100);
    });

    it('advanceBatch moves to next preset', () => {
      const presets = [
        { label: 'A', keywords: 'a', days: 7 },
        { label: 'B', keywords: 'b', days: 7 },
      ];
      jobManager.startBatch(presets);

      const next = jobManager.advanceBatch();
      expect(next).toEqual({ label: 'A', keywords: 'a', days: 7 });
      expect(jobManager.batchProgress?.current).toBe(1);
      expect(jobManager.batchProgress?.currentLabel).toBe('A');

      jobManager.cancelBatch();
    });

    it('completeBatchItem records result', () => {
      const presets = [
        { label: 'A', keywords: 'a', days: 7 },
        { label: 'B', keywords: 'b', days: 7 },
      ];
      jobManager.startBatch(presets);
      jobManager.advanceBatch();
      jobManager.completeBatchItem('A', true);

      expect(jobManager.batchProgress?.results).toEqual([
        { label: 'A', status: 'completed', emailed: true },
      ]);

      jobManager.cancelBatch();
    });

    it('advanceBatch returns null when queue is empty', () => {
      const presets = [{ label: 'A', keywords: 'a', days: 7 }];
      jobManager.startBatch(presets);
      jobManager.advanceBatch(); // A
      jobManager.completeBatchItem('A', true);
      const next = jobManager.advanceBatch();
      expect(next).toBeNull();

      // Batch should auto-complete
      expect(jobManager.isBatchRunning).toBe(false);
    });
  });
});
