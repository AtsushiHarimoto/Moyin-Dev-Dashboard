/**
 * Export API Routes
 * From gui-react/server/api/export.ts
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSessionsDatabase } from '../database';
import type { ExportData, ExportedQuestion } from '../types';
import { parseSessionProvider, SessionRow, MessageRow, sendError } from '../utils';

// Re-export for backward compatibility (used by hardening.test.ts)
export { parseSessionProvider };

const router = express.Router();

export const SAFE_EXPORT_ROOT = process.env.MOYIN_EXPORT_ROOT
  || path.resolve(process.cwd(), 'output');
class InputValidationError extends Error {}

export function sanitizeSessionIdForFilename(sessionId: string): string {
  const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
  const sanitized = sessionId
    .replace(/[<>:"/\\|?*=\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .replace(/[. ]+$/g, '');

  const truncated = sanitized.slice(0, 120) || 'session';
  if (windowsReservedName.test(truncated)) {
    return `_${truncated}`;
  }
  return truncated;
}

/**
 * Resolves export output path into SAFE_EXPORT_ROOT only.
 * User path may be relative (to SAFE_EXPORT_ROOT) or absolute (must still be inside SAFE_EXPORT_ROOT).
 */
export function resolveOutputPath(userPath: unknown, defaultFilename: string): string {
  fs.mkdirSync(SAFE_EXPORT_ROOT, { recursive: true });

  if (typeof userPath !== 'string' || userPath.trim().length === 0) {
    return path.join(SAFE_EXPORT_ROOT, defaultFilename);
  }

  const trimmedPath = userPath.trim();
  const resolvedPath = path.isAbsolute(trimmedPath)
    ? path.resolve(trimmedPath)
    : path.resolve(SAFE_EXPORT_ROOT, trimmedPath);
  const relative = path.relative(SAFE_EXPORT_ROOT, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new InputValidationError('Invalid output path: Must be within the configured export root');
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    throw new InputValidationError('Invalid output path: file path points to an existing directory');
  }

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  return resolvedPath;
}

/**
 * POST /api/export/questions
 * Export all user questions to JSON
 * Body: { outputPath?: string }
 */
router.post('/questions', async (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const { outputPath } = req.body;
    const db = getSessionsDatabase();
    const platform = os.platform() === 'win32' ? 'Windows' : 'Mac';

    const stmt = db.prepare(`
      SELECT
        m.timestamp,
        m.session_id,
        m.content AS question,
        s.custom_title,
        s.summary,
        s.project_path,
        s.git_branch
      FROM claude_messages_win m
      JOIN claude_sessions_win s ON m.session_id = s.session_id
      WHERE m.role = 'user' AND m.provider = ? AND s.provider = ?
      ORDER BY m.timestamp DESC
    `);

    const rows = stmt.all(provider, provider) as Array<{
      timestamp: string;
      session_id: string;
      question: string;
      custom_title: string | null;
      summary: string | null;
      project_path: string;
      git_branch: string | null;
    }>;

    const questions: ExportedQuestion[] = rows.map((row) => ({
      timestamp: row.timestamp,
      sessionId: row.session_id,
      sessionTitle: row.custom_title || row.summary || 'Untitled Session',
      projectPath: row.project_path,
      gitBranch: row.git_branch,
      question: row.question,
    }));

    const exportData: ExportData = {
      exportedAt: new Date().toISOString(),
      platform,
      totalQuestions: questions.length,
      questions,
    };

    const filePath = resolveOutputPath(outputPath, `user_questions_${Date.now()}.json`);

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log(`✅ Export complete: ${filePath}`);
    console.log(`   Total ${questions.length} user questions`);

    res.json({
      success: true,
      data: {
        filePath,
        totalQuestions: questions.length,
      },
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    sendError(res, error);
  }
});

/**
 * POST /api/export/session/:sessionId
 * Export single session to JSON
 * Body: { outputPath?: string }
 */
router.post('/session/:sessionId', async (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const { sessionId } = req.params;
    const { outputPath } = req.body;
    const db = getSessionsDatabase();

    const session = db
      .prepare('SELECT * FROM claude_sessions_win WHERE session_id = ? AND provider = ?')
      .get(sessionId, provider) as SessionRow | undefined;

    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Session not found: ${sessionId}`,
      });
    }

    const messages = db
      .prepare(
        `SELECT * FROM claude_messages_win
         WHERE session_id = ? AND provider = ?
         ORDER BY timestamp ASC`
      )
      .all(sessionId, provider) as MessageRow[];

    const exportData = {
      session,
      messages,
      exportedAt: new Date().toISOString(),
    };

    const safeSessionId = sanitizeSessionIdForFilename(sessionId);
    const filePath = resolveOutputPath(outputPath, `session_${safeSessionId}_${Date.now()}.json`);

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log(`✅ Export session complete: ${filePath}`);
    console.log(`   ${messages.length} messages`);

    res.json({
      success: true,
      data: {
        filePath,
        messageCount: messages.length,
      },
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    sendError(res, error);
  }
});

/**
 * POST /api/export/session/:sessionId/markdown
 * Export session to Markdown
 * Body: { outputPath?: string }
 */
router.post('/session/:sessionId/markdown', async (req, res) => {
  try {
    const provider = parseSessionProvider(req.query.provider);
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Supported: claude, codex, antigravity',
      });
    }
    const { sessionId } = req.params;
    const { outputPath } = req.body;
    const db = getSessionsDatabase();

    const session = db
      .prepare('SELECT * FROM claude_sessions_win WHERE session_id = ? AND provider = ?')
      .get(sessionId, provider) as SessionRow | undefined;

    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Session not found: ${sessionId}`,
      });
    }

    const messages = db
      .prepare(
        `SELECT * FROM claude_messages_win
         WHERE session_id = ? AND provider = ?
         ORDER BY timestamp ASC`
      )
      .all(sessionId, provider) as MessageRow[];

    let markdown = `# ${session.custom_title || session.summary || 'Untitled Session'}\n\n`;
    markdown += `**Project**: ${session.project_path}\n`;
    markdown += `**Branch**: ${session.git_branch || 'N/A'}\n`;
    markdown += `**Created**: ${session.created_at}\n`;
    markdown += `**Modified**: ${session.modified_at}\n`;
    markdown += `**Messages**: ${session.message_count}\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      const role = msg.role === 'user' ? '👤 USER' : '🤖 ASSISTANT';
      const timestamp = new Date(msg.timestamp).toLocaleString('zh-TW');

      markdown += `## ${role} (${timestamp})\n\n`;
      markdown += `${msg.content || '_No content_'}\n\n`;
      markdown += `---\n\n`;
    }

    const safeSessionId = sanitizeSessionIdForFilename(sessionId);
    const filePath = resolveOutputPath(outputPath, `session_${safeSessionId}_${Date.now()}.md`);

    fs.writeFileSync(filePath, markdown, 'utf-8');

    console.log(`✅ Export Markdown complete: ${filePath}`);

    res.json({
      success: true,
      data: { filePath },
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    sendError(res, error);
  }
});

export default router;
