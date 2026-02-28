/**
 * Messages API Routes
 * From gui-react/server/api/messages.ts
 *
 * IMPORTANT: Static routes MUST be declared before /:sessionId
 * to prevent Express from matching "search" or "user" as a sessionId.
 */

import express from 'express';
import { getSessionsDatabase } from '../database';
import type { Message, SearchResult } from '../types';
import {
  parseSessionProvider,
  SessionRow,
  MessageRow,
  toCamelCase as toCamelCaseSession,
  toCamelCaseMessage,
  sendError,
} from '../utils';

// Re-export for backward compatibility (used by hardening.test.ts)
export { parseSessionProvider };

const router = express.Router();

/**
 * Sanitizes FTS5 query input to prevent injection attacks
 */
function sanitizeFts5Query(query: string): string {
  return query
    .replace(/"/g, '""')
    .replace(/[*]/g, '')
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, '')
    .trim();
}

export function isFtsQueryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('fts5') ||
    message.includes('malformed match') ||
    message.includes('syntax error') ||
    message.includes('unterminated')
  );
}

type SearchJoinedRow = SessionRow & {
  content: string | null;
  timestamp: string;
  msg_message_type?: string;
  msg_role?: string;
};

// ========== Shared FTS Search Helper ==========

function performFtsSearch(provider: string, sanitizedQuery: string): SearchResult[] {
  const db = getSessionsDatabase();
  const stmt = db.prepare(`
    SELECT DISTINCT
      m.session_id,
      m.content,
      m.timestamp,
      m.message_type AS msg_message_type,
      m.role AS msg_role,
      s.*
    FROM claude_messages_fts fts
    JOIN claude_messages_win m ON fts.rowid = m.id
    JOIN claude_sessions_win s ON m.session_id = s.session_id
    WHERE fts MATCH ? AND m.provider = ? AND s.provider = ?
    ORDER BY m.timestamp DESC
    LIMIT 50
  `);

  const results = stmt.all(sanitizedQuery, provider, provider) as SearchJoinedRow[];
  const sessionMap = new Map<string, SearchResult>();

  for (const row of results) {
    const session = toCamelCaseSession(row);
    const { content, timestamp } = row;

    if (!sessionMap.has(session.sessionId)) {
      sessionMap.set(session.sessionId, {
        session,
        matchedMessages: [],
        matchType: 'message',
      });
    }

    sessionMap.get(session.sessionId)!.matchedMessages!.push({
      id: 0,
      provider,
      sessionId: session.sessionId,
      messageUuid: '',
      parentUuid: null,
      messageType: (row.msg_message_type as Message['messageType']) || 'user',
      role: (row.msg_role as Message['role']) || 'user',
      content,
      timestamp,
      cwd: null,
      gitBranch: null,
      syncedAt: '',
    });
  }

  return Array.from(sessionMap.values());
}

function handleFtsSearchRoute(req: express.Request, res: express.Response): void {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
      return;
    }
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
      return;
    }

    const sanitizedQuery = sanitizeFts5Query(query);
    if (!sanitizedQuery) {
      res.status(400).json({
        success: false,
        error: 'Invalid search query',
      });
      return;
    }

    const data = performFtsSearch(provider, sanitizedQuery);
    res.json({ success: true, data });
  } catch (error) {
    if (isFtsQueryError(error)) {
      res.status(400).json({
        success: false,
        error: 'Invalid search query',
      });
      return;
    }
    sendError(res, error);
  }
}

// ========== STATIC ROUTES FIRST ==========

/**
 * GET /api/messages/search?q=keyword
 * Full-text search (FTS5) across messages
 */
router.get('/search', (req, res) => handleFtsSearchRoute(req, res));

/**
 * GET /api/messages/search/messages?q=keyword
 * Search only in messages (FTS5)
 */
router.get('/search/messages', (req, res) => handleFtsSearchRoute(req, res));

/**
 * GET /api/messages/search/sessions?q=keyword
 * Search only in sessions (title, summary)
 */
router.get('/search/sessions', (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const db = getSessionsDatabase();
    const pattern = `%${query}%`;

    const stmt = db.prepare(`
      SELECT * FROM claude_sessions_win
      WHERE
        provider = ? AND (
        custom_title LIKE ? OR
        summary LIKE ? OR
        first_prompt LIKE ?
        )
      ORDER BY modified_at DESC
      LIMIT 50
    `);

    const sessions = (stmt.all(provider, pattern, pattern, pattern) as SessionRow[]).map(toCamelCaseSession);

    const results: SearchResult[] = sessions.map((session) => {
      let matchType: 'title' | 'firstPrompt' | 'message' = 'message';

      if (session.customTitle?.includes(query) || session.summary?.includes(query)) {
        matchType = 'title';
      } else if (session.firstPrompt?.includes(query)) {
        matchType = 'firstPrompt';
      }

      return { session, matchType };
    });

    res.json({ success: true, data: results });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/messages/user/all
 * Get all user messages
 */
router.get('/user/all', (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const parsedLimit = Number.parseInt(req.query.limit as string, 10);
    const parsedOffset = Number.parseInt(req.query.offset as string, 10);
    const limit = Math.max(1, Math.min(Number.isNaN(parsedLimit) ? 200 : parsedLimit, 1000));
    const offset = Math.max(0, Number.isNaN(parsedOffset) ? 0 : parsedOffset);

    const db = getSessionsDatabase();
    const stmt = db.prepare(`
      SELECT * FROM claude_messages_win
      WHERE role = 'user' AND provider = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const messages = (stmt.all(provider, limit, offset) as MessageRow[]).map(toCamelCaseMessage);

    res.json({ success: true, data: messages });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/messages/user/:sessionId
 * Get user messages for a specific session
 */
router.get('/user/:sessionId', (req, res) => {
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
      SELECT * FROM claude_messages_win
      WHERE role = 'user' AND session_id = ? AND provider = ?
      ORDER BY timestamp DESC
    `);

    const messages = (stmt.all(req.params.sessionId, provider) as MessageRow[]).map(toCamelCaseMessage);

    res.json({ success: true, data: messages });
  } catch (error) {
    sendError(res, error);
  }
});

// ========== DYNAMIC ROUTES LAST ==========

/**
 * GET /api/messages/:sessionId
 * Get all messages for a session
 */
router.get('/:sessionId', (req, res) => {
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
      SELECT * FROM claude_messages_win
      WHERE session_id = ? AND provider = ?
      ORDER BY timestamp ASC
    `);

    const messages = (stmt.all(req.params.sessionId, provider) as MessageRow[]).map(toCamelCaseMessage);

    res.json({ success: true, data: messages });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
