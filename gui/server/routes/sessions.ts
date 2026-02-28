/**
 * Sessions API Routes
 * From gui-react/server/api/sessions.ts
 */

import express from 'express';
import { getSessionsDatabase } from '../database';
import type { Session, FilterOptions } from '../types';
import { parseSessionProvider, SessionRow, toCamelCase, sendError } from '../utils';

// Re-export for backward compatibility (used by hardening.test.ts)
export { parseSessionProvider };

const router = express.Router();

/**
 * Validates and normalizes pagination parameters
 * @param page - Page number (min: 1)
 * @param limit - Items per page (min: 1, max: 100)
 * @returns Validated pagination parameters
 */
function validatePagination(page: unknown, limit: unknown): { page: number; limit: number } {
  const parsedPage = Number.parseInt(String(page), 10) || 1;
  const parsedLimit = Number.parseInt(String(limit), 10) || 20;

  // Enforce bounds
  const validPage = Math.max(1, parsedPage);
  const validLimit = Math.max(1, Math.min(100, parsedLimit));

  return { page: validPage, limit: validLimit };
}

/**
 * GET /api/sessions
 * Get all sessions with pagination
 */
router.get('/', (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    // Validate pagination parameters
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const offset = (page - 1) * limit;

    const db = getSessionsDatabase();

    const sessions = db
      .prepare(
        `SELECT * FROM claude_sessions_win
         WHERE provider = ?
         ORDER BY modified_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(provider, limit, offset) as SessionRow[];

    const total = db
      .prepare('SELECT COUNT(*) as count FROM claude_sessions_win WHERE provider = ?')
      .get(provider) as { count: number };

    res.json({
      success: true,
      data: sessions.map(toCamelCase),
      pagination: {
        page,
        limit,
        total: total.count,
        totalPages: Math.ceil(total.count / limit),
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/sessions/by-date
 * Get sessions grouped by date
 */
router.get('/by-date', (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const db = getSessionsDatabase();
    const stmt = db.prepare(`
      SELECT * FROM claude_sessions_win
      WHERE provider = ?
      ORDER BY modified_at DESC
    `);

    const sessions = (stmt.all(provider) as SessionRow[]).map(toCamelCase);
    const groups = new Map<string, Session[]>();

    for (const session of sessions) {
      const date = session.modifiedAt.split('T')[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(session);
    }

    const groupedData = Array.from(groups.entries()).map(([date, sessions]) => ({
      date,
      sessions,
    }));

    res.json({ success: true, data: groupedData });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * POST /api/sessions/filter
 * Filter sessions based on criteria
 * Body: FilterOptions
 */
router.post('/filter', (req, res) => {
  try {
    const options: FilterOptions = req.body;
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const db = getSessionsDatabase();

    let sql = 'SELECT * FROM claude_sessions_win WHERE provider = ?';
    const params: Array<string | number> = [provider];

    if (options.projectPath) {
      sql += ' AND project_path = ?';
      params.push(options.projectPath);
    }

    if (options.gitBranch) {
      sql += ' AND git_branch = ?';
      params.push(options.gitBranch);
    }

    if (options.dateRange) {
      sql += ' AND created_at >= ? AND created_at <= ?';
      params.push(options.dateRange.start, options.dateRange.end);
    }

    if (options.minMessageCount) {
      sql += ' AND message_count >= ?';
      params.push(options.minMessageCount);
    }

    sql += ' ORDER BY modified_at DESC';

    const stmt = db.prepare(sql);
    const sessions = (stmt.all(...params) as SessionRow[]).map(toCamelCase);

    res.json({ success: true, data: sessions });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/sessions/stats/summary
 * Get database statistics
 *
 * IMPORTANT: This route MUST be declared BEFORE /:id
 * to prevent Express from matching "stats" as a session ID.
 */
router.get('/stats/summary', (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const db = getSessionsDatabase();

    const sessionCount = db
      .prepare('SELECT COUNT(*) as count FROM claude_sessions_win WHERE provider = ?')
      .get(provider) as { count: number };
    const messageCount = db
      .prepare('SELECT COUNT(*) as count FROM claude_messages_win WHERE provider = ?')
      .get(provider) as { count: number };
    const userMessageCount = db
      .prepare("SELECT COUNT(*) as count FROM claude_messages_win WHERE provider = ? AND role = 'user'")
      .get(provider) as { count: number };

    const projects = db
      .prepare('SELECT DISTINCT project_path FROM claude_sessions_win WHERE provider = ?')
      .all(provider) as Array<{ project_path: string }>;
    const branches = db
      .prepare('SELECT DISTINCT git_branch FROM claude_sessions_win WHERE provider = ? AND git_branch IS NOT NULL')
      .all(provider) as Array<{ git_branch: string }>;

    res.json({
      success: true,
      data: {
        totalSessions: sessionCount.count,
        totalMessages: messageCount.count,
        totalUserMessages: userMessageCount.count,
        projects: projects.map((p) => p.project_path),
        branches: branches.map((b) => b.git_branch),
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/sessions/:id
 * Get single session by ID
 */
router.get('/:id', (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const db = getSessionsDatabase();
    const stmt = db.prepare(`
      SELECT * FROM claude_sessions_win WHERE session_id = ? AND provider = ?
    `);

    const row = stmt.get(req.params.id, provider) as SessionRow | undefined;
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({ success: true, data: toCamelCase(row) });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
