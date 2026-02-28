/**
 * localhostGuard — 僅允許 localhost 來源的請求通過
 *
 * 用於保護危險的變更端點（如 git commit、檔案搬移等），
 * 拒絕任何非本機 IP 的請求並回傳 403。
 */

/**
 * Localhost IP guard middleware.
 *
 * Mounted on all mutation routes (POST/PUT/DELETE) via mutationGuard in index.ts.
 * Verifies requests originate from localhost (127.0.0.1 or ::1).
 */
import type { RequestHandler } from 'express';

export const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const localhostGuard: RequestHandler = (req, res, next) => {
  if (!LOCALHOST_IPS.has(req.ip ?? '')) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: mutation endpoints are restricted to localhost',
    });
    return;
  }
  next();
};
