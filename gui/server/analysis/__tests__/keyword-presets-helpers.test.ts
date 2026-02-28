import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock external dependencies ──
vi.mock('../../database', () => ({
  getAnalysisDatabase: () => ({
    prepare: () => ({ run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) }),
  }),
}));

vi.mock('../mcp-client', () => ({
  createHermitPurpleClient: vi.fn(),
  callTool: vi.fn(),
  readResource: vi.fn(),
}));

const { findBalancedJsonEnd, KEYWORD_REFRESH_PER_CALL_TIMEOUT_MS, validateDiscoverScores, classifyMcpResult } = await import('../keyword-presets');
const { keywordRefreshJobManager } = await import('../keyword-refresh-job-manager');

beforeEach(() => {
  // Clean up any active job
  const active = keywordRefreshJobManager.getActiveJob();
  if (active && active.status !== 'completed' && active.status !== 'failed') {
    keywordRefreshJobManager.fail(active.id, 'test reset');
  }
});

// ── findBalancedJsonEnd ──────────────────────────────────────────────────────

describe('findBalancedJsonEnd', () => {
  it('finds end of simple array', () => {
    const text = '[1, 2, 3]';
    expect(findBalancedJsonEnd(text, 0)).toBe(8);
  });

  it('finds end of nested object', () => {
    const text = '{"a": {"b": [1]}}';
    expect(findBalancedJsonEnd(text, 0)).toBe(16);
  });

  it('handles strings with escaped quotes', () => {
    const text = '["hello \\"world\\"", "foo"]';
    const end = findBalancedJsonEnd(text, 0);
    expect(end).toBeGreaterThan(0);
    expect(JSON.parse(text.slice(0, end + 1))).toEqual(['hello "world"', 'foo']);
  });

  it('handles strings with backslashes and brackets', () => {
    const text = '{"key": "value with ] and ["}';
    const end = findBalancedJsonEnd(text, 0);
    expect(end).toBeGreaterThan(0);
    expect(JSON.parse(text.slice(0, end + 1))).toEqual({ key: 'value with ] and [' });
  });

  it('finds array after preamble text', () => {
    const text = 'Here are results:\n[{"keyword":"ai"}]';
    const idx = text.indexOf('[');
    const end = findBalancedJsonEnd(text, idx);
    expect(end).toBe(text.length - 1);
    expect(JSON.parse(text.slice(idx, end + 1))).toEqual([{ keyword: 'ai' }]);
  });

  it('finds first array when multiple JSON blocks exist', () => {
    const text = '["foo"] and then [{"keyword":"bar","score":0.8,"frequency":5}]';
    // First array starts at 0
    expect(findBalancedJsonEnd(text, 0)).toBe(6);
    // Second array starts at 18
    const idx2 = text.indexOf('[', 7);
    const end2 = findBalancedJsonEnd(text, idx2);
    expect(end2).toBe(text.length - 1);
  });

  it('returns -1 for unbalanced JSON', () => {
    expect(findBalancedJsonEnd('[1, 2', 0)).toBe(-1);
    expect(findBalancedJsonEnd('{"a": "b"', 0)).toBe(-1);
  });
});

// ── Schema validation / coercion ─────────────────────────────────────────────

describe('validateDiscoverScores', () => {
  it('accepts valid DiscoverScore objects', () => {
    const input = [
      { keyword: 'ai', score: 0.9, frequency: 5 },
      { keyword: 'ml', score: 0.7, frequency: 3, source: 'ai' },
    ];
    const result = validateDiscoverScores(input);
    expect(result).toHaveLength(2);
    expect(result[0].keyword).toBe('ai');
    expect(result[1].source).toBe('ai');
  });

  it('coerces string numbers to number', () => {
    const input = [{ keyword: 'ai', score: '0.8', frequency: '5' }];
    const result = validateDiscoverScores(input as unknown[]);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0.8);
    expect(result[0].frequency).toBe(5);
    expect(typeof result[0].score).toBe('number');
  });

  it('defaults non-finite score/frequency to 0', () => {
    const input = [{ keyword: 'ai', score: 'not-a-number', frequency: undefined }];
    const result = validateDiscoverScores(input as unknown[]);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0);
    expect(result[0].frequency).toBe(0);
  });

  it('rejects elements without keyword string', () => {
    const input = [
      { keyword: '', score: 0.5, frequency: 1 },
      { keyword: 123, score: 0.5, frequency: 1 },
      { score: 0.5, frequency: 1 },
      null,
      'just a string',
    ];
    expect(validateDiscoverScores(input as unknown[])).toHaveLength(0);
  });

  it('filters mixed valid/invalid elements', () => {
    const input = [
      { keyword: 'good', score: 0.9, frequency: 5 },
      { keyword: '', score: 0.5, frequency: 1 },
      { keyword: 'also-good', score: '0.3', frequency: 2 },
    ];
    const result = validateDiscoverScores(input as unknown[]);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.keyword)).toEqual(['good', 'also-good']);
  });
});

// ── classifyMcpResult (parser classification) ───────────────────────────────

describe('classifyMcpResult', () => {
  it('accepts valid DiscoverScore[] JSON', () => {
    const input = JSON.stringify([{ keyword: 'ai', score: 0.9, frequency: 5 }]);
    const result = classifyMcpResult(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.scores).toHaveLength(1);
  });

  it('classifies scalar string JSON as non_array', () => {
    const result = classifyMcpResult('"foo"');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('non_array');
    expect(result.skipReason).toContain('scalar');
  });

  it('classifies scalar number JSON as non_array', () => {
    const result = classifyMcpResult('123');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('non_array');
  });

  it('classifies non-array object without error as non_array', () => {
    const result = classifyMcpResult('{"foo":"bar"}');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('non_array');
    expect(result.skipReason).toBe('Non-array result');
  });

  it('classifies object with error field as non_array with error message', () => {
    const result = classifyMcpResult('{"error":"something broke"}');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('non_array');
    expect(result.skipReason).toContain('something broke');
  });

  it('classifies array with no valid schema as parse_error', () => {
    const result = classifyMcpResult('["foo", "bar"]');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('parse_error');
  });

  it('skips example array and finds valid DiscoverScore[] in preamble text', () => {
    const input = 'Here are examples: ["foo"] and the real data:\n' +
      JSON.stringify([{ keyword: 'ai', score: 0.9, frequency: 5 }]);
    const result = classifyMcpResult(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0].keyword).toBe('ai');
  });

  it('classifies completely unparseable text as parse_error', () => {
    const result = classifyMcpResult('not json at all');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('parse_error');
    expect(result.skipReason).toContain('JSON parse failed');
  });

  it('classifies empty string as parse_error', () => {
    const result = classifyMcpResult('');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('parse_error');
    expect(result.skipReason).toContain('JSON parse failed');
  });

  it('classifies empty array [] as empty_result', () => {
    const result = classifyMcpResult('[]');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('empty_result');
    expect(result.skipReason).toContain('empty result');
  });

  it('preserves specific reject reason for preamble + only invalid example JSON', () => {
    // Text with preamble and only an invalid array — should NOT be generic parse_error
    const input = 'Here are examples: ["foo", "bar"]';
    const result = classifyMcpResult(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('parse_error');
    expect(result.skipReason).toContain('no valid DiscoverScore');
  });

  it('classifies boolean JSON as non_array', () => {
    const result = classifyMcpResult('true');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('non_array');
    expect(result.skipReason).toContain('scalar');
  });

  it('classifies null JSON as non_array', () => {
    const result = classifyMcpResult('null');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.scores).toHaveLength(0);
    expect(result.errorType).toBe('non_array');
    expect(result.skipReason).toContain('scalar');
  });

  it('prefers earlier error object over later valid array (halt on explicit error)', () => {
    const input = 'preamble {"error":"upstream failed"} tail ' +
      JSON.stringify([{ keyword: 'ai', score: 0.9, frequency: 5 }]);
    const result = classifyMcpResult(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.errorType).toBe('non_array');
    expect(result.skipReason).toContain('upstream failed');
  });
});

describe('KEYWORD_REFRESH_PER_CALL_TIMEOUT_MS', () => {
  it('exports a shared constant equal to 180000', () => {
    expect(KEYWORD_REFRESH_PER_CALL_TIMEOUT_MS).toBe(180_000);
  });
});

// ── setDeadline ──────────────────────────────────────────────────────────────

describe('keywordRefreshJobManager.setDeadline', () => {
  it('sets dynamic deadline = now + presets × timeout + buffer', () => {
    const result = keywordRefreshJobManager.startOrReuse(true);
    keywordRefreshJobManager.markRunning(result.job.id);

    const before = Date.now();
    keywordRefreshJobManager.setDeadline(result.job.id, 6, 180_000);
    const after = Date.now();

    const job = keywordRefreshJobManager.getJob(result.job.id);
    expect(job).not.toBeNull();
    expect(job!.deadlineMs).not.toBeNull();

    // deadline ≈ now + 6×180000 + 120000 = now + 1200000
    const expected = 6 * 180_000 + 120_000;
    expect(job!.deadlineMs!).toBeGreaterThanOrEqual(before + expected);
    expect(job!.deadlineMs!).toBeLessThanOrEqual(after + expected);

    keywordRefreshJobManager.complete(result.job.id, 'test done');
  });

  it('getActiveJob returns null when deadline exceeded', () => {
    const result = keywordRefreshJobManager.startOrReuse(true);
    keywordRefreshJobManager.markRunning(result.job.id);

    // Set deadline to 1ms ago
    const job = keywordRefreshJobManager.getJob(result.job.id)!;
    job.deadlineMs = Date.now() - 1;

    // getActiveJob should detect stale and fail it
    const active = keywordRefreshJobManager.getActiveJob();
    expect(active).toBeNull();

    // Job should be marked as failed
    const failedJob = keywordRefreshJobManager.getJob(result.job.id);
    expect(failedJob!.status).toBe('failed');
  });

  it('getActiveJob keeps job alive when deadline not exceeded', () => {
    const result = keywordRefreshJobManager.startOrReuse(true);
    keywordRefreshJobManager.markRunning(result.job.id);
    keywordRefreshJobManager.setDeadline(result.job.id, 1, 180_000);

    const active = keywordRefreshJobManager.getActiveJob();
    expect(active).not.toBeNull();
    expect(active!.id).toBe(result.job.id);

    keywordRefreshJobManager.complete(result.job.id, 'test done');
  });
});
