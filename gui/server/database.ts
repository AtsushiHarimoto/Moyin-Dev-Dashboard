/**
 * Database initialization and management
 * Handles both claude-sessions.db and skills.db
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

// DB files always live next to this source file (gui/server/)
const DB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DB_PATH = path.join(DB_DIR, 'claude-sessions.db');
const SKILLS_DB_PATH = path.join(DB_DIR, 'skills.db');
const DEFAULT_PROVIDER = 'claude';

// ========== Sessions Database (from gui-react) ==========

let sessionsDbInstance: Database.Database | null = null;

export function initSessionsDatabase(): Database.Database {
  if (sessionsDbInstance) return sessionsDbInstance;

  const db = new Database(SESSIONS_DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS claude_sessions_win (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'claude',
      session_id TEXT UNIQUE NOT NULL,
      project_path TEXT NOT NULL,
      git_branch TEXT,
      custom_title TEXT,
      summary TEXT,
      first_prompt TEXT,
      message_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      file_mtime INTEGER,
      full_path TEXT NOT NULL,
      is_sidechain BOOLEAN DEFAULT 0,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON claude_sessions_win(project_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_branch ON claude_sessions_win(git_branch);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON claude_sessions_win(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_modified ON claude_sessions_win(modified_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_mtime ON claude_sessions_win(file_mtime);
  `);

  // Create messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS claude_messages_win (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'claude',
      session_id TEXT NOT NULL,
      message_uuid TEXT UNIQUE NOT NULL,
      parent_uuid TEXT,
      message_type TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      timestamp TEXT NOT NULL,
      cwd TEXT,
      git_branch TEXT,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES claude_sessions_win(session_id) ON DELETE CASCADE
    );
  `);

  // Create message indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session ON claude_messages_win(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON claude_messages_win(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON claude_messages_win(message_type);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON claude_messages_win(role);
  `);

  // Create report_read_status table for tracking read reports
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_read_status (
      report_id TEXT PRIMARY KEY,
      read_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create index for read status
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_report_read_at ON report_read_status(read_at DESC);
  `);

  // Create FTS5 full-text search virtual table
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS claude_messages_fts USING fts5(
      content,
      content=claude_messages_win,
      content_rowid=id
    );
  `);

  // Create triggers for FTS index
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON claude_messages_win BEGIN
      INSERT INTO claude_messages_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON claude_messages_win BEGIN
      INSERT INTO claude_messages_fts(claude_messages_fts, rowid, content) VALUES('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON claude_messages_win BEGIN
      INSERT INTO claude_messages_fts(claude_messages_fts, rowid, content) VALUES('delete', old.id, old.content);
      INSERT INTO claude_messages_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `);

  // Lightweight migrations for existing DBs
  const sessionColumns = db
    .prepare('PRAGMA table_info(claude_sessions_win)')
    .all() as Array<{ name: string }>;
  if (!sessionColumns.some(column => column.name === 'provider')) {
    db.exec(`ALTER TABLE claude_sessions_win ADD COLUMN provider TEXT NOT NULL DEFAULT '${DEFAULT_PROVIDER}'`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_provider ON claude_sessions_win(provider)`);
  }

  const messageColumns = db
    .prepare('PRAGMA table_info(claude_messages_win)')
    .all() as Array<{ name: string }>;
  if (!messageColumns.some(column => column.name === 'provider')) {
    db.exec(`ALTER TABLE claude_messages_win ADD COLUMN provider TEXT NOT NULL DEFAULT '${DEFAULT_PROVIDER}'`);
  }
  // Create provider indexes after provider column is guaranteed to exist
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_provider ON claude_sessions_win(provider)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_provider ON claude_messages_win(provider)`);

  console.log('✅ Sessions database initialized:', SESSIONS_DB_PATH);

  sessionsDbInstance = db;
  return db;
}

export function getSessionsDatabase(): Database.Database {
  if (!sessionsDbInstance) {
    initSessionsDatabase();
  }
  return sessionsDbInstance!;
}

// ========== Report Read Status Functions ==========

export interface ReportReadStatus {
  report_id: string;
  read_at: string;
  updated_at: string;
}

/**
 * Mark a report as read
 */
export function markReportAsRead(reportId: string): void {
  const db = getSessionsDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO report_read_status (report_id, read_at, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(report_id) DO UPDATE SET
      read_at = excluded.read_at,
      updated_at = excluded.updated_at
  `).run(reportId, now, now);
}

/**
 * Check if a report is read
 */
export function isReportRead(reportId: string): boolean {
  const db = getSessionsDatabase();
  const result = db
    .prepare('SELECT report_id FROM report_read_status WHERE report_id = ?')
    .get(reportId);
  return Boolean(result);
}

/**
 * Get all read report IDs
 */
export function getAllReadReportIds(): Set<string> {
  const db = getSessionsDatabase();
  const rows = db
    .prepare('SELECT report_id FROM report_read_status')
    .all() as Array<{ report_id: string }>;
  return new Set(rows.map(r => r.report_id));
}

/**
 * Get read status for multiple reports
 */
export function getReportReadStatuses(reportIds: string[]): Map<string, ReportReadStatus> {
  if (reportIds.length === 0) return new Map();

  const db = getSessionsDatabase();
  const placeholders = reportIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM report_read_status WHERE report_id IN (${placeholders})`)
    .all(...reportIds) as ReportReadStatus[];

  return new Map(rows.map(r => [r.report_id, r]));
}

export function getClaudeSessionPath(): string {
  const platform = os.platform();

  if (platform === 'win32') {
    const username = process.env.USERNAME || process.env.USER;
    if (!username) {
      throw new Error('Cannot get username');
    }

    const projectPath = getProjectRoot();
    const encodedPath = projectPath.replace(/:\\/g, '--').replace(/\\/g, '-');

    return path.join(
      'C:',
      'Users',
      username,
      '.claude',
      'projects',
      encodedPath
    );
  } else if (platform === 'darwin') {
    const homeDir = os.homedir();
    const projectPath = getProjectRoot();
    const encodedPath = projectPath.replace(/\//g, '-');

    return path.join(homeDir, '.claude', 'projects', encodedPath);
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function getCodexHistoryPath(): string {
  return path.join(os.homedir(), '.codex', 'history.jsonl');
}

export function getCodexSessionsPath(): string {
  return path.join(os.homedir(), '.codex', 'sessions');
}

function getProjectRoot(): string {
  let currentDir = process.cwd();

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

// ========== Skills Database (NEW - from legacy/db-manager.js) ==========

let skillsDbInstance: Database.Database | null = null;

export function initSkillsDatabase(): Database.Database {
  if (skillsDbInstance) return skillsDbInstance;

  const db = new Database(SKILLS_DB_PATH);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      name TEXT PRIMARY KEY,
      description TEXT,
      description_zh TEXT,
      category TEXT
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)');

  const skillColumns = db
    .prepare('PRAGMA table_info(skills)')
    .all() as Array<{ name: string }>;

  const hasDescriptionZh = skillColumns.some(column => column.name === 'description_zh');
  if (!hasDescriptionZh) {
    db.exec('ALTER TABLE skills ADD COLUMN description_zh TEXT');
    console.log('✅ Skills database migrated: added description_zh column');
  }

  console.log('✅ Skills database initialized:', SKILLS_DB_PATH);

  skillsDbInstance = db;
  return db;
}


export function getSkillsDatabase(): Database.Database {
  if (!skillsDbInstance) {
    initSkillsDatabase();
  }
  return skillsDbInstance!;
}

// ========== Wiki Database (NEW) ==========

let wikiDbInstance: Database.Database | null = null;
const WIKI_DB_PATH = path.join(DB_DIR, 'wiki.db');

export function initWikiDatabase(): Database.Database {
  if (wikiDbInstance) return wikiDbInstance;

  const db = new Database(WIKI_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create wiki_projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_projects (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Create wiki_files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      full_path TEXT NOT NULL,
      size INTEGER,
      last_modified TEXT,
      FOREIGN KEY (project_id) REFERENCES wiki_projects(id) ON DELETE CASCADE
    );
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_wiki_projects_category ON wiki_projects(category);
    CREATE INDEX IF NOT EXISTS idx_wiki_files_project ON wiki_files(project_id);
  `);

  console.log('✅ Wiki database initialized:', WIKI_DB_PATH);

  wikiDbInstance = db;
  return db;
}

export function getWikiDatabase(): Database.Database {
  if (!wikiDbInstance) {
    initWikiDatabase();
  }
  return wikiDbInstance!;
}

// ========== Analysis Database (NEW - Hermit Purple integration) ==========

let analysisDbInstance: Database.Database | null = null;
const ANALYSIS_DB_PATH = path.join(DB_DIR, 'analysis.db');

export function initAnalysisDatabase(): Database.Database {
  if (analysisDbInstance) return analysisDbInstance;

  const db = new Database(ANALYSIS_DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'starting',
      keywords TEXT,
      days INTEGER DEFAULT 3,
      scrape_count INTEGER DEFAULT 0,
      audit_count INTEGER DEFAULT 0,
      report_md TEXT,
      insights_json TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created ON analysis_jobs(created_at DESC);
  `);

  // keyword_presets 表 — 動態熱詞系統
  db.exec(`
    CREATE TABLE IF NOT EXISTS keyword_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT '🔮',
      label_key TEXT,
      description_key TEXT,
      seed_keywords TEXT NOT NULL,
      discovered_keywords TEXT DEFAULT '',
      merged_keywords TEXT DEFAULT '',
      discover_score_json TEXT,
      last_refreshed TEXT,
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_keyword_presets_category ON keyword_presets(category);
    CREATE INDEX IF NOT EXISTS idx_keyword_presets_builtin ON keyword_presets(is_builtin);
  `);

  console.log('✅ Analysis database initialized:', ANALYSIS_DB_PATH);

  analysisDbInstance = db;
  return db;
}

export function getAnalysisDatabase(): Database.Database {
  if (!analysisDbInstance) {
    initAnalysisDatabase();
  }
  return analysisDbInstance!;
}

// ========== Analysis WAL Checkpoint ==========

export function checkpointAnalysisDatabase(): void {
  if (!analysisDbInstance) return;
  try {
    analysisDbInstance.pragma('wal_checkpoint(PASSIVE)');
  } catch (err) {
    console.warn('[database] WAL checkpoint failed:', err);
  }
}

// ========== Database Cleanup ==========

export function closeDatabases(): void {
  if (sessionsDbInstance) {
    sessionsDbInstance.close();
    sessionsDbInstance = null;
    console.log('✅ Sessions database closed');
  }
  if (skillsDbInstance) {
    skillsDbInstance.close();
    skillsDbInstance = null;
    console.log('✅ Skills database closed');
  }
  if (wikiDbInstance) {
    wikiDbInstance.close();
    wikiDbInstance = null;
    console.log('✅ Wiki database closed');
  }
  if (analysisDbInstance) {
    analysisDbInstance.close();
    analysisDbInstance = null;
    console.log('✅ Analysis database closed');
  }
}
