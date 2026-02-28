/**
 * Codex 會話同步邏輯
 */

import fs from 'fs';
import path from 'path';
import {
  getSessionsDatabase,
  getCodexHistoryPath,
  getCodexSessionsPath,
} from '../../database';
import {
  safeParseJson,
  toDbSessionId,
  type CodexHistoryEntry,
  type SyncProvider,
} from './index';

function extractCodexMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part: unknown) => {
      if (!part || typeof part !== 'object') return '';
      const p = part as Record<string, unknown>;
      if (typeof p.text === 'string') return p.text;
      if (typeof p.content === 'string') return p.content;
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function walkJsonlFiles(dir: string, output: string[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonlFiles(full, output);
      continue;
    }
    if (entry.isFile() && full.endsWith('.jsonl')) {
      output.push(full);
    }
  }
}

function parseCodexSessionFileMeta(filePath: string): {
  rawSessionId: string;
  cwd: string | null;
  gitBranch: string | null;
  fileMtime: number;
} | null {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines.slice(0, 40)) {
    const obj = safeParseJson<Record<string, unknown>>(line);
    if (!obj || obj.type !== 'session_meta') continue;
    const payload = obj.payload as Record<string, unknown> | undefined;
    if (!payload?.id) continue;
    const stat = fs.statSync(filePath);
    const git = payload.git as Record<string, unknown> | undefined;
    return {
      rawSessionId: String(payload.id),
      cwd: payload.cwd ? String(payload.cwd) : null,
      gitBranch: git?.branch ? String(git.branch) : null,
      fileMtime: stat.mtimeMs,
    };
  }
  return null;
}

export async function syncSessionsCodex() {
  const db = getSessionsDatabase();
  const historyPath = getCodexHistoryPath();
  const sessionsRoot = getCodexSessionsPath();

  const result = {
    synced: 0,
    updated: 0,
    errors: [] as string[],
  };

  if (!fs.existsSync(historyPath)) {
    result.errors.push(`Codex history file not found: ${historyPath}`);
    return result;
  }

  try {
    const historyLines = fs.readFileSync(historyPath, 'utf-8').split('\n').filter(Boolean);
    const historyEntries = historyLines
      .map((line) => safeParseJson<CodexHistoryEntry>(line))
      .filter((item): item is CodexHistoryEntry => Boolean(item?.session_id));

    const aggregate = new Map<string, {
      rawSessionId: string;
      firstPrompt: string | null;
      summary: string | null;
      count: number;
      minTs: number;
      maxTs: number;
    }>();

    for (const entry of historyEntries) {
      const rawSessionId = String(entry.session_id);
      const ts = typeof entry.ts === 'number' ? entry.ts : Math.floor(Date.now() / 1000);
      const text = typeof entry.text === 'string' ? entry.text.trim() : '';
      const current = aggregate.get(rawSessionId);
      if (!current) {
        aggregate.set(rawSessionId, {
          rawSessionId,
          firstPrompt: text || null,
          summary: text || null,
          count: 1,
          minTs: ts,
          maxTs: ts,
        });
        continue;
      }
      current.count += 1;
      if (!current.firstPrompt && text) current.firstPrompt = text;
      if (text) current.summary = text;
      if (ts < current.minTs) current.minTs = ts;
      if (ts > current.maxTs) current.maxTs = ts;
    }

    const sessionFiles: string[] = [];
    walkJsonlFiles(sessionsRoot, sessionFiles);
    const fileMetaMap = new Map<string, {
      fullPath: string;
      cwd: string | null;
      gitBranch: string | null;
      fileMtime: number;
    }>();

    for (const filePath of sessionFiles) {
      const meta = parseCodexSessionFileMeta(filePath);
      if (!meta) continue;
      fileMetaMap.set(meta.rawSessionId, {
        fullPath: filePath,
        cwd: meta.cwd,
        gitBranch: meta.gitBranch,
        fileMtime: meta.fileMtime,
      });
    }

    const selectStmt = db.prepare(`SELECT * FROM claude_sessions_win WHERE session_id = ? AND provider = ?`);
    const insertStmt = db.prepare(`
      INSERT INTO claude_sessions_win (
        provider, session_id, project_path, git_branch, custom_title, summary,
        first_prompt, message_count, created_at, modified_at,
        file_mtime, full_path, is_sidechain
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStmt = db.prepare(`
      UPDATE claude_sessions_win SET
        project_path = ?,
        git_branch = ?,
        summary = ?,
        first_prompt = ?,
        message_count = ?,
        modified_at = ?,
        file_mtime = ?,
        full_path = ?,
        synced_at = CURRENT_TIMESTAMP
      WHERE session_id = ? AND provider = ?
    `);

    const tx = db.transaction(() => {
      for (const item of aggregate.values()) {
        try {
          const dbSessionId = toDbSessionId('codex', item.rawSessionId);
          const fileMeta = fileMetaMap.get(item.rawSessionId);
          const createdAt = new Date(item.minTs * 1000).toISOString();
          const modifiedAt = new Date(item.maxTs * 1000).toISOString();
          const fileMtime = fileMeta?.fileMtime || item.maxTs * 1000;
          const fullPath = fileMeta?.fullPath || historyPath;
          const projectPath = fileMeta?.cwd || 'unknown';
          const gitBranch = fileMeta?.gitBranch || null;
          const existing = selectStmt.get(dbSessionId, 'codex') as any;

          if (!existing) {
            insertStmt.run(
              'codex',
              dbSessionId,
              projectPath,
              gitBranch,
              null,
              item.summary || null,
              item.firstPrompt || null,
              item.count,
              createdAt,
              modifiedAt,
              fileMtime,
              fullPath,
              0
            );
            result.synced++;
            continue;
          }

          if (Number(existing.file_mtime || 0) < fileMtime || Number(existing.message_count || 0) < item.count) {
            updateStmt.run(
              projectPath,
              gitBranch,
              item.summary || null,
              item.firstPrompt || null,
              item.count,
              modifiedAt,
              fileMtime,
              fullPath,
              dbSessionId,
              'codex'
            );
            result.updated++;
          }
        } catch (error) {
          result.errors.push(`Sync codex session failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });

    tx();
  } catch (error) {
    result.errors.push(`Sync codex sessions failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export async function syncSessionMessagesCodex(sessionId: string, jsonlPath: string) {
  const db = getSessionsDatabase();
  const result = {
    synced: 0,
    errors: [] as string[],
  };

  if (!fs.existsSync(jsonlPath)) {
    result.errors.push(`Message file not found: ${jsonlPath}`);
    return result;
  }

  try {
    const lines = fs.readFileSync(jsonlPath, 'utf-8').split('\n').filter(Boolean);
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO claude_messages_win (
        provider, session_id, message_uuid, parent_uuid, message_type, role,
        content, timestamp, cwd, git_branch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (let i = 0; i < lines.length; i++) {
        const obj = safeParseJson<Record<string, unknown>>(lines[i]);
        if (!obj) continue;
        const timestamp = typeof obj.timestamp === 'string' ? obj.timestamp : new Date().toISOString();
        const payload = obj.payload as Record<string, unknown> | undefined;

        if (obj.type === 'response_item' && payload?.type === 'message') {
          const role = payload.role === 'assistant' ? 'assistant' : 'user';
          const text = extractCodexMessageText(payload.content).trim();
          const uuid = `${sessionId}:response_item:${i}`;
          const insertResult = insertStmt.run(
            'codex',
            sessionId,
            uuid,
            null,
            role,
            role,
            text || null,
            timestamp,
            null,
            null
          );
          result.synced += Number(insertResult.changes || 0);
          continue;
        }

        if (obj.type === 'event_msg' && (payload?.type === 'user_message' || payload?.type === 'agent_message')) {
          const role = payload.type === 'agent_message' ? 'assistant' : 'user';
          const text = typeof payload.message === 'string' ? payload.message.trim() : '';
          if (!text) continue;
          const uuid = `${sessionId}:event_msg:${payload.type}:${i}`;
          const insertResult = insertStmt.run(
            'codex',
            sessionId,
            uuid,
            null,
            role,
            role,
            text,
            timestamp,
            null,
            null
          );
          result.synced += Number(insertResult.changes || 0);
        }
      }
    });

    tx();
  } catch (error) {
    result.errors.push(`Read message file failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}
