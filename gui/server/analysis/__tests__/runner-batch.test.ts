import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all external dependencies ──

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
  checkpointAnalysisDatabase: vi.fn(),
}));

vi.mock('../mcp-client', () => ({
  createHermitPurpleClient: vi.fn(),
  acquireSharedClient: vi.fn(),
  destroySharedClient: vi.fn(),
  killSharedTransport: vi.fn(),
  callTool: vi.fn(),
  readResource: vi.fn(),
}));

vi.mock('../../services/email', () => ({
  sendReport: vi.fn(),
  isEmailConfigured: vi.fn(() => false),
  closeEmailTransport: vi.fn(),
}));

vi.mock('../../utils', () => ({
  REPORTS_ROOT: '/tmp/test-reports',
}));

vi.mock('fs-extra', () => ({
  default: { ensureDir: vi.fn(), writeFile: vi.fn() },
}));

// ── Import after mocks ──

const { createHermitPurpleClient, acquireSharedClient, destroySharedClient, callTool, readResource } = await import('../mcp-client');
const { runBatchAnalysis } = await import('../runner');
const { jobManager } = await import('../job-manager');

const mockCreateClient = vi.mocked(createHermitPurpleClient);
const mockAcquireShared = vi.mocked(acquireSharedClient);
const mockDestroyShared = vi.mocked(destroySharedClient);
const mockCallTool = vi.mocked(callTool);
const mockReadResource = vi.mocked(readResource);

beforeEach(() => {
  mockRun.mockReset();
  mockGet.mockReset();
  mockAll.mockReset().mockReturnValue([]);
  mockCreateClient.mockReset();
  mockAcquireShared.mockReset();
  mockDestroyShared.mockReset();
  mockCallTool.mockReset();
  mockReadResource.mockReset();

  if (jobManager.isBatchRunning) jobManager.cancelBatch();
  if (jobManager.isRunning) jobManager.updateStatus('failed', 0, 'test reset', 0);

  const fakeTransport = { close: vi.fn() };
  const fakeClient = {} as never;
  mockCreateClient.mockResolvedValue({ client: fakeClient, transport: fakeTransport as never });
  mockAcquireShared.mockResolvedValue({ client: fakeClient, transport: fakeTransport as never });
  mockDestroyShared.mockResolvedValue(undefined);
  mockCallTool.mockImplementation(async (_client: never, toolName: string) => {
    if (toolName === 'scrape_ai_trends') return JSON.stringify({ ok: true, data: { scraped: 10 } });
    if (toolName === 'run_ai_curator') return JSON.stringify({ ok: true, data: { attempted: 10, succeeded: 5, failed: 0 } });
    if (toolName === 'generate_weekly_report') return JSON.stringify({ ok: true });
    return '{}';
  });
  mockReadResource.mockResolvedValue('# Report\n\nSummary.\n\n## Adopt\n\n- **Tool**: good');
});

describe('runBatchAnalysis integration', () => {
  it('calls createJob with _batchInternal=true and completes batch', async () => {
    const createJobSpy = vi.spyOn(jobManager, 'createJob');

    const presets = [
      { label: 'A', keywords: 'ai', days: 7 },
      { label: 'B', keywords: 'ml', days: 3 },
    ];

    await runBatchAnalysis(presets);

    // createJob should have been called twice, both with _batchInternal=true
    expect(createJobSpy).toHaveBeenCalledTimes(2);
    expect(createJobSpy).toHaveBeenNthCalledWith(1, 'ai', 7, 'A', true);
    expect(createJobSpy).toHaveBeenNthCalledWith(2, 'ml', 3, 'B', true);

    // Batch should be completed (not running)
    expect(jobManager.isBatchRunning).toBe(false);

    createJobSpy.mockRestore();
  });

  it('records batch item results after each analysis', async () => {
    const completeSpy = vi.spyOn(jobManager, 'completeBatchItem');

    const presets = [{ label: 'Solo', keywords: 'x', days: 1 }];
    await runBatchAnalysis(presets);

    expect(completeSpy).toHaveBeenCalledWith('Solo', false);

    completeSpy.mockRestore();
  });

  it('records failure when createJob throws', async () => {
    const failSpy = vi.spyOn(jobManager, 'failBatchItem');
    const createSpy = vi.spyOn(jobManager, 'createJob')
      .mockImplementationOnce(() => { throw new Error('TEST_ERROR'); });

    const presets = [{ label: 'Fail', keywords: 'y', days: 1 }];
    await runBatchAnalysis(presets);

    expect(failSpy).toHaveBeenCalledWith('Fail');

    createSpy.mockRestore();
    failSpy.mockRestore();
  });

  it('detects internal runAnalysis failure via job.status and rebuilds subprocess', async () => {
    const failSpy = vi.spyOn(jobManager, 'failBatchItem');
    const completeSpy = vi.spyOn(jobManager, 'completeBatchItem');

    // Make callTool throw on first call (CrashItem's scrape), then resume normal JSON responses
    mockCallTool
      .mockRejectedValueOnce(new Error('MCP_CRASH'))
      .mockImplementation(async (_client: never, toolName: string) => {
        if (toolName === 'scrape_ai_trends') return JSON.stringify({ ok: true, data: { scraped: 10 } });
        if (toolName === 'run_ai_curator') return JSON.stringify({ ok: true, data: { attempted: 10, succeeded: 5, failed: 0 } });
        if (toolName === 'generate_weekly_report') return JSON.stringify({ ok: true });
        return '{}';
      });

    const presets = [
      { label: 'CrashItem', keywords: 'x', days: 1 },
      { label: 'OkItem', keywords: 'y', days: 1 },
    ];
    await runBatchAnalysis(presets);

    // First item should be recorded as failed (not completed)
    expect(failSpy).toHaveBeenCalledWith('CrashItem');
    // destroySharedClient should be called for rebuild
    expect(mockDestroyShared).toHaveBeenCalled();
    // Second item should succeed
    expect(completeSpy).toHaveBeenCalledWith('OkItem', false);

    expect(jobManager.isBatchRunning).toBe(false);

    failSpy.mockRestore();
    completeSpy.mockRestore();
  });

  it('converges batch state when acquireSharedClient fails before loop', async () => {
    mockAcquireShared.mockRejectedValueOnce(new Error('PYTHON_NOT_FOUND'));

    const presets = [
      { label: 'A', keywords: 'a', days: 1 },
      { label: 'B', keywords: 'b', days: 1 },
    ];
    await runBatchAnalysis(presets);

    // Batch must NOT be stuck in running
    expect(jobManager.isBatchRunning).toBe(false);
  });

  it('always calls destroySharedClient and closeEmailTransport in finally', async () => {
    const { closeEmailTransport } = await import('../../services/email');
    const mockCloseEmail = vi.mocked(closeEmailTransport);

    const presets = [{ label: 'X', keywords: 'z', days: 1 }];
    await runBatchAnalysis(presets);

    expect(mockDestroyShared).toHaveBeenCalled();
    expect(mockCloseEmail).toHaveBeenCalled();
  });

  it('records failure when generate_weekly_report returns ok:false', async () => {
    const failSpy = vi.spyOn(jobManager, 'failBatchItem');

    mockCallTool.mockImplementation(async (_client: never, toolName: string) => {
      if (toolName === 'scrape_ai_trends') return JSON.stringify({ ok: true, data: { scraped: 10 } });
      if (toolName === 'run_ai_curator') return JSON.stringify({ ok: true, data: { attempted: 10, succeeded: 5, failed: 0 } });
      if (toolName === 'generate_weekly_report') return JSON.stringify({ ok: false, error: 'report generation failed' });
      return '{}';
    });

    const presets = [{ label: 'ReportFail', keywords: 'x', days: 1 }];
    await runBatchAnalysis(presets);

    expect(failSpy).toHaveBeenCalledWith('ReportFail');

    failSpy.mockRestore();
  });

  it('records failure when callTool returns malformed JSON for generate_weekly_report', async () => {
    const failSpy = vi.spyOn(jobManager, 'failBatchItem');

    mockCallTool.mockImplementation(async (_client: never, toolName: string) => {
      if (toolName === 'scrape_ai_trends') return JSON.stringify({ ok: true, data: { scraped: 10 } });
      if (toolName === 'run_ai_curator') return JSON.stringify({ ok: true, data: { attempted: 10, succeeded: 5, failed: 0 } });
      if (toolName === 'generate_weekly_report') return 'not json at all';
      return '{}';
    });

    const presets = [{ label: 'MalformedReport', keywords: 'x', days: 1 }];
    await runBatchAnalysis(presets);

    expect(failSpy).toHaveBeenCalledWith('MalformedReport');

    failSpy.mockRestore();
  });
});
