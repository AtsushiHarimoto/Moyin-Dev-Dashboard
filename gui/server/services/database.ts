/**
 * 數據庫初始化與表結構創建
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'claude-sessions.db');

/**
 * 初始化數據庫並創建表結構
 */
export function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  
  // 啟用外鍵約束
  db.pragma('foreign_keys = ON');
  
  // 創建會話元數據表（Windows）
  db.exec(`
    CREATE TABLE IF NOT EXISTS claude_sessions_win (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  
  // 創建索引（性能優化）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON claude_sessions_win(project_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_branch ON claude_sessions_win(git_branch);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON claude_sessions_win(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_modified ON claude_sessions_win(modified_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_mtime ON claude_sessions_win(file_mtime);
  `);
  
  // 創建消息詳情表（Windows）
  db.exec(`
    CREATE TABLE IF NOT EXISTS claude_messages_win (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  
  // 創建消息表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session ON claude_messages_win(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON claude_messages_win(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON claude_messages_win(message_type);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON claude_messages_win(role);
  `);
  
  // 創建 FTS5 全文搜索虛擬表
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS claude_messages_fts USING fts5(
      content,
      content=claude_messages_win,
      content_rowid=id
    );
  `);
  
  // 創建觸發器：自動更新 FTS 索引
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
  
  console.log('✅ Database initialized:', DB_PATH);
  
  return db;
}

/**
 * 獲取數據庫實例（單例模式）
 */
let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

/**
 * 關閉數據庫連接
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('✅ Database closed');
  }
}

/**
 * 獲取項目根目錄（向上查找包含 .git 的目錄）
 */
function getProjectRoot(): string {
  let currentDir = process.cwd();
  
  // 向上查找，最多 5 層
  for (let i = 0; i < 5; i++) {
    const gitPath = path.join(currentDir, '.git');
    if (fs.existsSync(gitPath)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // 已到根目錄
    }
    currentDir = parentDir;
  }
  
  // 如果找不到 .git，使用當前目錄
  return process.cwd();
}

/**
 * 獲取 Windows 環境下的 Claude 會話路徑
 */
export function getClaudeSessionPath(): string {
  const platform = os.platform();
  
  if (platform === 'win32') {
    const username = process.env.USERNAME || process.env.USER;
    if (!username) {
      throw new Error('無法獲取用戶名');
    }
    
    // 使用項目根目錄
    const projectPath = getProjectRoot();
    // 編碼項目路徑（Claude Code 的路徑編碼規則）
    // 注意：必須先替換 :\，再替換剩餘的 \
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
    // Mac 支援（Phase 3）
    const homeDir = os.homedir();
    const projectPath = getProjectRoot();
    const encodedPath = projectPath.replace(/\//g, '-');
    
    return path.join(homeDir, '.claude', 'projects', encodedPath);
  } else {
    throw new Error(`不支援的操作系統: ${platform}`);
  }
}
