/**
 * Claude 會話同步邏輯
 */

import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import {
  getSessionsDatabase,
  getClaudeSessionPath,
} from '../../database';
import {
  safeParseJson,
  toDbSessionId,
  formatMessageContent,
  type SessionIndexEntry,
  type SessionsIndex,
  type JsonlMessage,
  type BackfillSessionRow,
  type SyncProvider,
} from './index';

/**
 * Extract text content from a JSONL message object.
 */
function extractJsonlMessageText(msg: JsonlMessage): string | null {
  if (!msg.message?.content) return null;
  const text = typeof msg.message.content === 'string'
    ? msg.message.content
    : msg.message.content.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(' ');
  return text.trim() || null;
}

/**
 * Count newline characters in a file using chunked reads (constant memory).
 */
function countFileNewlines(fd: number, fileSize: number): number {
  const CHUNK = 64 * 1024;
  const buf = Buffer.alloc(CHUNK);
  let count = 0;
  let pos = 0;
  while (pos < fileSize) {
    const bytesRead = fs.readSync(fd, buf, 0, CHUNK, pos);
    if (bytesRead === 0) break;
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0x0A) count++;
    }
    pos += bytesRead;
  }
  return count;
}

function hasTrailingNewline(fd: number, fileSize: number): boolean {
  if (fileSize <= 0) return false;
  const lastByte = Buffer.alloc(1);
  const bytesRead = fs.readSync(fd, lastByte, 0, 1, fileSize - 1);
  return bytesRead === 1 && lastByte[0] === 0x0A;
}

/**
 * Parse a Claude JSONL session file to extract basic metadata.
 * Reads head/tail of file to avoid loading entire content into memory.
 */
function parseClaudeJsonlMeta(filePath: string): {
  sessionId: string;
  firstPrompt: string | null;
  summary: string | null;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string | null;
  projectPath: string | null;
} | null {
  const HEAD_SIZE = 8 * 1024;
  const TAIL_SIZE = 8 * 1024;
  let fd: number | null = null;

  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return null;

    fd = fs.openSync(filePath, 'r');
    const basename = path.basename(filePath, '.jsonl');

    // --- Read head ---
    const headBuf = Buffer.alloc(Math.min(HEAD_SIZE, stat.size));
    fs.readSync(fd, headBuf, 0, headBuf.length, 0);
    const headText = headBuf.toString('utf-8');
    const headLines = headText.split('\n').filter(Boolean);
    // Last line from head chunk may be truncated — drop it unless file fits in HEAD_SIZE
    if (stat.size > HEAD_SIZE) headLines.pop();

    let firstPrompt: string | null = null;
    let created: string | null = null;
    let gitBranch: string | null = null;
    let projectPath: string | null = null;

    for (const line of headLines) {
      const obj = safeParseJson<JsonlMessage>(line);
      if (!obj?.uuid) continue;
      if (!created && obj.timestamp) created = obj.timestamp;
      if (!gitBranch && obj.gitBranch) gitBranch = obj.gitBranch;
      if (!projectPath && obj.cwd) projectPath = obj.cwd;
      if (!firstPrompt && obj.type === 'user') {
        firstPrompt = extractJsonlMessageText(obj)?.substring(0, 200) ?? null;
      }
      // Once we have all head metadata, stop early
      if (created && gitBranch && projectPath && firstPrompt) break;
    }

    if (!created) { fs.closeSync(fd); return null; }

    // --- Read tail ---
    let modified: string | null = null;
    let lastAssistantText: string | null = null;

    const tailStart = Math.max(0, stat.size - TAIL_SIZE);
    const tailBuf = Buffer.alloc(stat.size - tailStart);
    fs.readSync(fd, tailBuf, 0, tailBuf.length, tailStart);
    const tailText = tailBuf.toString('utf-8');
    const tailLines = tailText.split('\n').filter(Boolean);
    // First line from tail chunk may be truncated — drop it unless reading from start
    if (tailStart > 0) tailLines.shift();

    // Scan tail lines in reverse for last timestamp + last assistant message
    for (let i = tailLines.length - 1; i >= 0; i--) {
      const obj = safeParseJson<JsonlMessage>(tailLines[i]);
      if (!obj?.uuid) continue;
      if (!modified && obj.timestamp) modified = obj.timestamp;
      if (!lastAssistantText && obj.type === 'assistant') {
        lastAssistantText = extractJsonlMessageText(obj)?.substring(0, 200) ?? null;
      }
      if (modified && lastAssistantText) break;
    }

    // --- Count JSONL rows for messageCount ---
    // JSONL files may not end with '\n', so newline count can be off by one.
    const newlineCount = countFileNewlines(fd, stat.size);
    const messageCount = stat.size > 0 && !hasTrailingNewline(fd, stat.size)
      ? newlineCount + 1
      : newlineCount;

    fs.closeSync(fd);
    fd = null;

    return {
      sessionId: basename,
      firstPrompt,
      summary: lastAssistantText || firstPrompt,
      messageCount,
      created,
      modified: modified || created,
      gitBranch,
      projectPath,
    };
  } catch {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* ignore */ }
    return null;
  }
}

export async function syncSessionsClaude() {
  const db = getSessionsDatabase();
  const sessionPath = getClaudeSessionPath();
  const indexPath = path.join(sessionPath, 'sessions-index.json');

  const result = {
    synced: 0,
    updated: 0,
    errors: [] as string[],
  };

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
      summary = ?,
      custom_title = ?,
      message_count = ?,
      modified_at = ?,
      file_mtime = ?,
      synced_at = CURRENT_TIMESTAMP
    WHERE session_id = ? AND provider = ?
  `);

  // Phase 1: Sync from sessions-index.json (rich metadata)
  const indexedSessionIds = new Set<string>();

  if (fs.existsSync(indexPath)) {
    try {
      const indexData: SessionsIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

      const syncTransaction = db.transaction((entries: SessionIndexEntry[]) => {
        for (const entry of entries) {
          try {
            const sessionId = toDbSessionId('claude', entry.sessionId);
            indexedSessionIds.add(entry.sessionId);
            const existing = selectStmt.get(sessionId, 'claude') as any;

            if (!existing) {
              insertStmt.run(
                'claude',
                sessionId,
                entry.projectPath,
                entry.gitBranch || null,
                entry.customTitle || null,
                entry.summary || null,
                entry.firstPrompt || null,
                entry.messageCount,
                entry.created,
                entry.modified,
                entry.fileMtime,
                entry.fullPath,
                entry.isSidechain ? 1 : 0
              );
              result.synced++;
            } else if (existing.file_mtime < entry.fileMtime) {
              updateStmt.run(
                entry.summary || null,
                entry.customTitle || null,
                entry.messageCount,
                entry.modified,
                entry.fileMtime,
                sessionId,
                'claude'
              );
              result.updated++;
            }
          } catch (error) {
            result.errors.push(`Sync session ${entry.sessionId} failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      });

      syncTransaction(indexData.entries);
    } catch (error) {
      result.errors.push(`Read sessions index failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Phase 2: Scan JSONL files for sessions not in index (fallback)
  if (fs.existsSync(sessionPath)) {
    try {
      const jsonlFiles: string[] = [];
      const entries = fs.readdirSync(sessionPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          jsonlFiles.push(path.join(sessionPath, entry.name));
        }
      }

      const scanTransaction = db.transaction((files: string[]) => {
        for (const filePath of files) {
          const basename = path.basename(filePath, '.jsonl');

          // Skip sessions already handled by index
          if (indexedSessionIds.has(basename)) {
            // Still check if file is newer than DB record for updates
            const sessionId = toDbSessionId('claude', basename);
            const existing = selectStmt.get(sessionId, 'claude') as any;
            if (existing) {
              const stat = fs.statSync(filePath);
              if (existing.file_mtime < stat.mtimeMs) {
                const meta = parseClaudeJsonlMeta(filePath);
                if (meta) {
                  updateStmt.run(
                    meta.summary || null,
                    null,
                    meta.messageCount,
                    meta.modified,
                    stat.mtimeMs,
                    sessionId,
                    'claude'
                  );
                  result.updated++;
                }
              }
            }
            continue;
          }

          // New session not in index — parse from JSONL
          const sessionId = toDbSessionId('claude', basename);
          const existing = selectStmt.get(sessionId, 'claude') as any;
          const stat = fs.statSync(filePath);

          if (!existing) {
            const meta = parseClaudeJsonlMeta(filePath);
            if (meta) {
              insertStmt.run(
                'claude',
                sessionId,
                meta.projectPath || sessionPath,
                meta.gitBranch || null,
                null,
                meta.summary || null,
                meta.firstPrompt || null,
                meta.messageCount,
                meta.created,
                meta.modified,
                stat.mtimeMs,
                filePath,
                0
              );
              result.synced++;
            }
          } else if (existing.file_mtime < stat.mtimeMs) {
            const meta = parseClaudeJsonlMeta(filePath);
            if (meta) {
              updateStmt.run(
                meta.summary || null,
                null,
                meta.messageCount,
                meta.modified,
                stat.mtimeMs,
                sessionId,
                'claude'
              );
              result.updated++;
            }
          }
        }
      });

      scanTransaction(jsonlFiles);
    } catch (error) {
      result.errors.push(`JSONL scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

export async function syncSessionMessagesClaude(sessionId: string, jsonlPath: string) {
  const db = getSessionsDatabase();
  const result = {
    synced: 0,
    errors: [] as string[],
  };

  if (!fs.existsSync(jsonlPath)) {
    result.errors.push(`Message file not found: ${jsonlPath}`);
    return result;
  }

  let fd: number | null = null;
  try {
    fd = fs.openSync(jsonlPath, 'r');
    const CHUNK_SIZE = 64 * 1024;
    const buffer = Buffer.alloc(CHUNK_SIZE);
    let leftover = '';

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO claude_messages_win (
        provider, session_id, message_uuid, parent_uuid, message_type, role,
        content, timestamp, cwd, git_branch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const processLine = (line: string) => {
      if (!line.trim()) return;
      const msg = safeParseJson<JsonlMessage>(line);
      if (!msg?.uuid) return;
      try {
        const content = formatMessageContent(msg.message?.content);
        const insertResult = insertStmt.run(
          'claude',
          sessionId,
          msg.uuid,
          msg.parentUuid || null,
          msg.type,
          msg.message?.role || msg.type,
          content || null,
          msg.timestamp,
          msg.cwd || null,
          msg.gitBranch || null
        );
        result.synced += Number(insertResult.changes || 0);
      } catch (error) {
        if (error instanceof Error && !error.message.includes('UNIQUE')) {
          result.errors.push(`Sync message ${msg.uuid} failed: ${error.message}`);
        }
      }
    };

    const tx = db.transaction(() => {
      let bytesRead: number;
      while ((bytesRead = fs.readSync(fd!, buffer, 0, CHUNK_SIZE, null)) > 0) {
        const chunk = leftover + buffer.toString('utf-8', 0, bytesRead);
        const lines = chunk.split('\n');
        leftover = lines.pop() || '';
        for (const line of lines) {
          processLine(line);
        }
      }
      // Process leftover (last line without trailing newline)
      if (leftover.trim()) {
        processLine(leftover);
      }
    });

    tx();
  } catch (error) {
    result.errors.push(`Read message file failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* ignore */ }
  }

  return result;
}
