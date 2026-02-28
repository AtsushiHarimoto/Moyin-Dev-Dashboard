import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import issuesRouter from '../issues';

describe('Issues Routes — Read-Only Policy', () => {
  function mockReqRes() {
    const req = { body: {} } as express.Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as express.Response;
    return { req, res };
  }

  it('POST /move returns 403', () => {
    // Extract the route handler
    const moveHandler = (issuesRouter as any).stack
      .find((layer: any) => layer.route?.path === '/move' && layer.route?.methods?.post)
      ?.route?.stack?.[0]?.handle;

    expect(moveHandler).toBeDefined();

    const { req, res } = mockReqRes();
    moveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('POST /commit returns 403', () => {
    const commitHandler = (issuesRouter as any).stack
      .find((layer: any) => layer.route?.path === '/commit' && layer.route?.methods?.post)
      ?.route?.stack?.[0]?.handle;

    expect(commitHandler).toBeDefined();

    const { req, res } = mockReqRes();
    commitHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});
