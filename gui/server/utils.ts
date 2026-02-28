/**
 * Shared utilities for Skills Switch GUI Backend
 * Extracted from sessions.ts, messages.ts, export.ts to eliminate duplication.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import type { Response } from 'express';
import type { Session, Message, SessionProvider } from './types';

// ========== Centralized Workspace Root ==========

export const WORKSPACE_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

// 統一報告目錄：所有模組共用同一個 hermit-purple/reports 路徑
export const REPORTS_ROOT = path.join(WORKSPACE_ROOT, 'tools', 'hermit-purple', 'reports');

// ========== Path Encoding ==========

export function encodePath(filePath: string): string {
  return Buffer.from(filePath, 'utf8').toString('base64url');
}

export function decodePath(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf-8');
}

// ========== Database Row Interfaces ==========

export interface SessionRow {
  session_id: string;
  provider?: SessionProvider | null;
  project_path: string;
  git_branch: string | null;
  custom_title: string | null;
  summary: string | null;
  first_prompt: string | null;
  message_count: number;
  created_at: string;
  modified_at: string;
  file_mtime: number | null;
  full_path: string;
  is_sidechain: number | boolean | null;
}

export interface MessageRow {
  id: number;
  provider?: SessionProvider | null;
  session_id: string;
  message_uuid: string;
  parent_uuid: string | null;
  message_type: string;
  role: string;
  content: string | null;
  timestamp: string;
  cwd: string | null;
  git_branch: string | null;
  synced_at: string;
}

// ========== Provider Validation ==========

export function parseSessionProvider(value: unknown): SessionProvider | null {
  if (value === undefined || value === null || value === '' || value === 'claude') {
    return 'claude';
  }
  if (value === 'codex' || value === 'antigravity') {
    return value;
  }
  return null;
}

// ========== Row-to-Model Mappers ==========

/** Maps a SessionRow (snake_case DB row) to a Session (camelCase model). */
export const toCamelCase = (row: SessionRow): Session => ({
  sessionId: row.session_id,
  provider: row.provider || 'claude',
  projectPath: row.project_path,
  gitBranch: row.git_branch,
  customTitle: row.custom_title,
  summary: row.summary,
  firstPrompt: row.first_prompt,
  messageCount: row.message_count,
  createdAt: row.created_at,
  modifiedAt: row.modified_at,
  fileMtime: row.file_mtime,
  fullPath: row.full_path,
  isSidechain: Boolean(row.is_sidechain),
});

/** Maps a MessageRow (snake_case DB row) to a Message (camelCase model). */
export const toCamelCaseMessage = (row: MessageRow): Message => ({
  id: row.id,
  provider: row.provider || 'claude',
  sessionId: row.session_id,
  messageUuid: row.message_uuid,
  parentUuid: row.parent_uuid,
  messageType: row.message_type as Message['messageType'],
  role: row.role as Message['role'],
  content: row.content,
  timestamp: row.timestamp,
  cwd: row.cwd,
  gitBranch: row.git_branch,
  syncedAt: row.synced_at,
});

// ========== Error Helper ==========

export function sendError(res: Response, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(status).json({ success: false, error: message });
}
