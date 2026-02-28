/**
 * Sync API Routes
 * Supports provider=claude|codex (antigravity reserved)
 */

import express from 'express';
import {
  getSessionsDatabase,
} from '../database';
import {
  parseSyncProvider,
  ensureSyncCapableProvider,
  parsePositiveInt,
  validateJsonlPath,
  isSamePathByPlatform,
  getBackfillQueue,
  syncSessions,
  syncSessionMessages,
  InputValidationError,
} from '../services/sync';

const router = express.Router();

// Re-export for tests
export { parseSyncProvider, isSamePathByPlatform, getBackfillQueue } from '../services/sync';

/**
 * POST /api/sync/all
 * Full sync (sessions + messages)
 */
router.post('/all', async (req, res) => {
  try {
    const requestedProvider = parseSyncProvider(req.query.provider);
    if (!requestedProvider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const provider = ensureSyncCapableProvider(requestedProvider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider antigravity does not support sync',
      });
    }
    const batchSize = Math.max(1, Math.min(100, parsePositiveInt(req.query.batchSize, 20)));
    const cursor = parsePositiveInt(req.query.cursor, 0);

    const result = {
      provider,
      sessions: { synced: 0, updated: 0 },
      messages: {
        synced: 0,
        backfilledSessions: 0,
        processedSessions: 0,
        totalSessions: 0,
        hasMore: false,
        nextCursor: null as number | null,
      },
      errors: [] as string[],
    };

    const sessionResult = await syncSessions(provider);
    result.sessions.synced = sessionResult.synced;
    result.sessions.updated = sessionResult.updated;
    result.errors.push(...sessionResult.errors);

    const db = getSessionsDatabase();
    const queue = getBackfillQueue(db, batchSize, cursor, provider);
    const sessionsToSync = queue.sessions;

    result.messages.totalSessions = queue.total;
    result.messages.backfilledSessions = sessionsToSync.length;
    result.messages.processedSessions = Math.min(cursor + sessionsToSync.length, queue.total);
    result.messages.hasMore = result.messages.processedSessions < queue.total;
    result.messages.nextCursor = result.messages.hasMore ? result.messages.processedSessions : null;

    for (const session of sessionsToSync) {
      const messageResult = await syncSessionMessages(session.session_id, session.full_path, provider);
      result.messages.synced += messageResult.synced;
      result.errors.push(...messageResult.errors);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sync/sessions
 * Sync only session metadata
 */
router.post('/sessions', async (req, res) => {
  try {
    const requestedProvider = parseSyncProvider(req.query.provider);
    if (!requestedProvider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const provider = ensureSyncCapableProvider(requestedProvider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider antigravity does not support sync',
      });
    }
    const result = await syncSessions(provider);
    res.json({ success: true, data: { provider, ...result } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/sync/messages/:sessionId
 * Sync single session messages
 * Body: { jsonlPath: string }
 */
router.post('/messages/:sessionId', async (req, res) => {
  try {
    const requestedProvider = parseSyncProvider(req.query.provider);
    if (!requestedProvider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const provider = ensureSyncCapableProvider(requestedProvider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider antigravity does not support sync',
      });
    }
    const { sessionId } = req.params;
    const { jsonlPath } = req.body;

    if (!jsonlPath) {
      return res.status(400).json({
        success: false,
        error: 'jsonlPath is required in request body',
      });
    }

    const validatedPath = validateJsonlPath(jsonlPath, provider);
    const db = getSessionsDatabase();
    const row = db
      .prepare('SELECT full_path FROM claude_sessions_win WHERE session_id = ? AND provider = ?')
      .get(sessionId, provider) as { full_path: string } | undefined;

    if (!row) {
      return res.status(404).json({
        success: false,
        error: `Session not found: ${sessionId}`,
      });
    }

    if (!isSamePathByPlatform(row.full_path, validatedPath)) {
      return res.status(400).json({
        success: false,
        error: 'jsonlPath does not match the session source file',
      });
    }

    const result = await syncSessionMessages(sessionId, validatedPath, provider);
    return res.json({ success: true, data: { provider, ...result } });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
