import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally before importing the module under test
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Dynamic import so the stub is in place when the module initializes
const { sessionsApi, skillsApi } = await import('./api');

// Reconfigure baseUrl for Node test environment (needs full URL, not relative path)
const { configure } = await import('@moyin/net-client');
configure({ baseUrl: 'http://localhost:38881/api' });

beforeEach(() => {
  mockFetch.mockReset();
});

/** Helper: create a mock Response compatible with net-client's fetchRequest */
function mockResponse(status: number, body: unknown, ok?: boolean) {
  const isOk = ok ?? (status >= 200 && status < 300);
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const isJson = typeof body !== 'string';

  return {
    ok: isOk,
    status,
    statusText: status === 500 ? 'Internal Server Error'
      : status === 502 ? 'Bad Gateway'
      : status === 404 ? 'Not Found'
      : 'OK',
    headers: new Headers({
      'content-type': isJson ? 'application/json' : 'text/html',
    }),
    json: isJson ? async () => body : async () => { throw new SyntaxError('Unexpected token <'); },
    text: async () => bodyStr,
  };
}

describe('apiRequest — response.ok guard', () => {
  it('throws on HTTP 500 with JSON error body', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(500, { success: false, error: 'Server crashed' })
    );

    await expect(sessionsApi.getAll()).rejects.toThrow('API error 500');
  });

  it('throws on HTTP 502 Bad Gateway (HTML body)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(502, '<html>Bad Gateway</html>')
    );

    await expect(skillsApi.getAll()).rejects.toThrow('API error 502');
  });

  it('throws on HTTP 404 Not Found', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(404, { success: false, error: 'Not found' })
    );

    await expect(sessionsApi.getById('nonexistent')).rejects.toThrow('API error 404');
  });
});

describe('apiRequest — result.success guard', () => {
  it('throws when success is false with custom error message', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: false, error: '會話不存在' })
    );

    await expect(sessionsApi.getAll()).rejects.toThrow('會話不存在');
  });

  it('throws generic message when success is false without error field', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: false })
    );

    await expect(sessionsApi.getAll()).rejects.toThrow('API request failed');
  });
});

describe('apiRequest — happy path', () => {
  it('returns data on successful response', async () => {
    const mockSessions = [{ id: '1', name: 'test' }];
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: mockSessions })
    );

    const result = await sessionsApi.getAll();
    expect(result).toEqual(mockSessions);
  });
});
