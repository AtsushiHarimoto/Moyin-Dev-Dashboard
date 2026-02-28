/**
 * 同步服務 — 共用類型、工具函數與統一導出
 */

import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { SessionProvider } from '../../types';
import {
  getSessionsDatabase,
  getClaudeSessionPath,
  getCodexSessionsPath,
} from '../../database';

// ========== Shared Types ==========

export type SyncProvider = 'claude' | 'codex';

export class InputValidationError extends Error {}

export interface SessionIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  firstPrompt: string;
  summary: string;
  customTitle?: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
}

export interface SessionsIndex {
  version: number;
  entries: SessionIndexEntry[];
}

export interface JsonlMessage {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  type: 'user' | 'assistant';
  message?: {
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string }>;
  };
  timestamp: string;
  cwd?: string;
  gitBranch?: string;
}

export interface BackfillSessionRow {
  session_id: string;
  full_path: string;
}

export interface CodexHistoryEntry {
  session_id?: string;
  ts?: number;
  text?: string;
}

export interface ContentPart {
  type: string;
  text?: string;
  name?: string;
  content?: string | ContentPart[];
}

// ========== Shared Utility Functions ==========

export function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function toDbSessionId(provider: SyncProvider, rawSessionId: string): string {
  if (provider === 'codex') {
    return `codex:${rawSessionId}`;
  }
  return rawSessionId;
}

export function getProviderSessionRoot(provider: SyncProvider): string {
  return provider === 'codex' ? getCodexSessionsPath() : getClaudeSessionPath();
}

/**
 * Validates that jsonlPath is within the provider's sessions directory.
 * Prevents arbitrary file read via path traversal.
 */
export function validateJsonlPath(jsonlPath: string, provider: SyncProvider): string {
  const sessionRoot = getProviderSessionRoot(provider);
  const resolved = path.resolve(jsonlPath);
  const relative = path.relative(sessionRoot, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new InputValidationError('Invalid path: must be within provider sessions directory');
  }

  return resolved;
}

export function isSamePathByPlatform(leftPath: string, rightPath: string): boolean {
  const left = path.resolve(leftPath);
  const right = path.resolve(rightPath);
  if (process.platform === 'win32') {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

export function parseSyncProvider(value: unknown): SessionProvider | null {
  if (value === undefined || value === null || value === '' || value === 'claude') {
    return 'claude';
  }
  if (value === 'codex') {
    return 'codex';
  }
  if (value === 'antigravity') {
    return 'antigravity';
  }
  return null;
}

export function ensureSyncCapableProvider(provider: SessionProvider): SyncProvider | null {
  if (provider === 'claude' || provider === 'codex') {
    return provider;
  }
  return null;
}

export function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Format message content for DB storage.
 */
export function formatMessageContent(raw: string | ContentPart[] | undefined): string {
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (part.type === 'text') return part.text ?? '';
        if (part.type === 'tool_use') return `[Tool: ${part.name ?? 'unknown'}]`;
        if (part.type === 'tool_result') {
          if (part.content) {
            if (typeof part.content === 'string') {
              return part.content.length > 500 ? `${part.content.substring(0, 500)}... (truncated)` : part.content;
            }
            if (Array.isArray(part.content)) {
              return part.content
                .map((c) => {
                  if (c.type === 'text') {
                    const text = c.text ?? '';
                    return text.length > 500 ? `${text.substring(0, 500)}... (truncated)` : text;
                  }
                  if (c.type === 'image') return '[Image]';
                  return '';
                })
                .join('\n');
            }
          }
          return '[Tool Result]';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  if (typeof raw === 'string') return raw;
  return '';
}

export function getBackfillQueue(
  db: Database.Database,
  batchSize: number,
  cursor: number,
  provider: SyncProvider = 'claude'
): { total: number; sessions: BackfillSessionRow[] } {
  if (provider === 'claude') {
    const totalRow = db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM claude_sessions_win s
         LEFT JOIN (
           SELECT session_id, provider, COUNT(*) AS actual_count
           FROM claude_messages_win
           GROUP BY session_id, provider
         ) m ON s.session_id = m.session_id AND s.provider = m.provider
         WHERE s.provider = ? AND s.message_count > IFNULL(m.actual_count, 0)`
      )
      .get(provider) as { total: number };

    const sessions = db
      .prepare(
        `SELECT
           s.session_id,
           s.full_path
         FROM claude_sessions_win s
         LEFT JOIN (
           SELECT session_id, provider, COUNT(*) AS actual_count
           FROM claude_messages_win
           GROUP BY session_id, provider
         ) m ON s.session_id = m.session_id AND s.provider = m.provider
         WHERE s.provider = ? AND s.message_count > IFNULL(m.actual_count, 0)
         ORDER BY s.modified_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(provider, batchSize, cursor) as BackfillSessionRow[];

    return {
      total: totalRow.total,
      sessions,
    };
  }

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM claude_sessions_win WHERE provider = ?`)
    .get(provider) as { total: number };

  const sessions = db
    .prepare(
      `SELECT session_id, full_path
       FROM claude_sessions_win
       WHERE provider = ?
       ORDER BY modified_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(provider, batchSize, cursor) as BackfillSessionRow[];

  return {
    total: totalRow.total,
    sessions,
  };
}

// ========== Dispatcher functions ==========

export async function syncSessions(provider: SyncProvider) {
  if (provider === 'codex') {
    const { syncSessionsCodex } = await import('./codex');
    return syncSessionsCodex();
  }
  const { syncSessionsClaude } = await import('./claude');
  return syncSessionsClaude();
}

export async function syncSessionMessages(sessionId: string, jsonlPath: string, provider: SyncProvider) {
  if (provider === 'codex') {
    const { syncSessionMessagesCodex } = await import('./codex');
    return syncSessionMessagesCodex(sessionId, jsonlPath);
  }
  const { syncSessionMessagesClaude } = await import('./claude');
  return syncSessionMessagesClaude(sessionId, jsonlPath);
}
