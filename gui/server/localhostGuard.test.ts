import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { localhostGuard, LOCALHOST_IPS } from './localhostGuard';

/**
 * localhostGuard 中介層單元測試
 *
 * 驗證僅允許 localhost IP 通過，非本機 IP 回傳 403。
 */

/** 建立模擬 req / res / next */
function createMocks(ip: string | undefined) {
  const req = { ip } as Partial<Request> as Request;
  const jsonFn = vi.fn();
  const statusFn = vi.fn(() => ({ json: jsonFn }));
  const res = { status: statusFn } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, statusFn, jsonFn };
}

describe('localhostGuard middleware', () => {
  it('允許 127.0.0.1 通過（呼叫 next）', () => {
    const { req, res, next } = createMocks('127.0.0.1');
    localhostGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('允許 ::1（IPv6 loopback）通過', () => {
    const { req, res, next } = createMocks('::1');
    localhostGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('允許 ::ffff:127.0.0.1（IPv4-mapped IPv6）通過', () => {
    const { req, res, next } = createMocks('::ffff:127.0.0.1');
    localhostGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('拒絕外部 IP 192.168.1.100 → 回傳 403', () => {
    const { req, res, next, statusFn, jsonFn } = createMocks('192.168.1.100');
    localhostGuard(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusFn).toHaveBeenCalledWith(403);
    expect(jsonFn).toHaveBeenCalledWith({
      success: false,
      error: 'Forbidden: mutation endpoints are restricted to localhost',
    });
  });

  it('req.ip 為 undefined 時 → 回傳 403', () => {
    const { req, res, next, statusFn, jsonFn } = createMocks(undefined);
    localhostGuard(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusFn).toHaveBeenCalledWith(403);
    expect(jsonFn).toHaveBeenCalledWith({
      success: false,
      error: 'Forbidden: mutation endpoints are restricted to localhost',
    });
  });

  it('LOCALHOST_IPS 恰好包含三個允許的 IP', () => {
    expect(LOCALHOST_IPS.size).toBe(3);
    expect(LOCALHOST_IPS.has('127.0.0.1')).toBe(true);
    expect(LOCALHOST_IPS.has('::1')).toBe(true);
    expect(LOCALHOST_IPS.has('::ffff:127.0.0.1')).toBe(true);
  });
});
