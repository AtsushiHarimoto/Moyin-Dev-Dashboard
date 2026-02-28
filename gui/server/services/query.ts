/**
 * 數據庫查詢服務
 */

import { getDatabase } from './database';
import type { Session, Message, SessionGroup, SearchResult, FilterOptions } from '../types';

// 輔助函數：將數據庫行轉換為前端 Session 對象
const toCamelCaseSession = (row: any): Session => ({
  sessionId: row.session_id,
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
  isSidechain: Boolean(row.is_sidechain)
});

// 輔助函數：將數據庫行轉換為前端 Message 對象
const toCamelCaseMessage = (row: any): Message => ({
  id: row.id,
  sessionId: row.session_id,
  messageUuid: row.message_uuid,
  parentUuid: row.parent_uuid,
  messageType: row.message_type,
  role: row.role,
  content: row.content,
  timestamp: row.timestamp,
  cwd: row.cwd,
  gitBranch: row.git_branch,
  syncedAt: row.synced_at
});

/**
 * 獲取所有會話（按修改時間倒序）
 */
export function getAllSessions(): Session[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM claude_sessions_win
    ORDER BY modified_at DESC
  `);
  
  return (stmt.all() as any[]).map(toCamelCaseSession);
}

/**
 * 按日期分組獲取會話
 */
export function getSessionsByDate(): SessionGroup[] {
  const sessions = getAllSessions();
  const groups = new Map<string, Session[]>();
  
  for (const session of sessions) {
    const date = session.modifiedAt.split('T')[0]; // 提取日期部分
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(session);
  }
  
  return Array.from(groups.entries()).map(([date, sessions]) => ({
    date,
    sessions,
  }));
}

/**
 * 根據 session_id 獲取會話
 */
export function getSessionById(sessionId: string): Session | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM claude_sessions_win WHERE session_id = ?
  `);
  
  const row = stmt.get(sessionId);
  return row ? toCamelCaseSession(row) : null;
}

/**
 * 獲取會話的所有消息
 */
export function getSessionMessages(sessionId: string): Message[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM claude_messages_win
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `);
  
  return (stmt.all(sessionId) as any[]).map(toCamelCaseMessage);
}

/**
 * 獲取會話的用戶消息（用於導出）
 */
export function getUserMessages(sessionId?: string): Message[] {
  const db = getDatabase();
  
  let stmt;
  if (sessionId) {
    stmt = db.prepare(`
      SELECT * FROM claude_messages_win
      WHERE role = 'user' AND session_id = ?
      ORDER BY timestamp DESC
    `);
    return (stmt.all(sessionId) as any[]).map(toCamelCaseMessage);
  } else {
    stmt = db.prepare(`
      SELECT * FROM claude_messages_win
      WHERE role = 'user'
      ORDER BY timestamp DESC
    `);
    return (stmt.all() as any[]).map(toCamelCaseMessage);
  }
}

/**
 * 全文搜索（使用 FTS5）
 */
export function searchMessages(query: string): SearchResult[] {
  // ... (保留 SearchResult 的特殊結構處理，但確保內部 Session 正確轉換)
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT DISTINCT
      m.session_id,
      m.content,
      m.timestamp,
      s.*
    FROM claude_messages_fts fts
    JOIN claude_messages_win m ON fts.rowid = m.id
    JOIN claude_sessions_win s ON m.session_id = s.session_id
    WHERE fts MATCH ?
    ORDER BY m.timestamp DESC
    LIMIT 50
  `);
  
  const results = stmt.all(query) as any[];
  
  const sessionMap = new Map<string, SearchResult>();
  
  for (const row of results) {
    const session = toCamelCaseSession(row); // 提取會話部分
    const { content, timestamp } = row; // 提取消息部分
    
    if (!sessionMap.has(session.sessionId)) {
      sessionMap.set(session.sessionId, {
        session,
        matchedMessages: [],
        matchType: 'message',
      });
    }
    
    // ... (matchedMessages 不需要完整 Message 對象，但這里我們手動構造)
    // 注意：SearchResult 的 matchedMessages 類型其實是 Message[] 的子集或擴展
    // 這裡為了簡單，我們構造一個符合接口的對象
    
    sessionMap.get(session.sessionId)!.matchedMessages!.push({
      id: 0, 
      sessionId: session.sessionId,
      messageUuid: '',
      parentUuid: null,
      messageType: 'user', // FTS 沒有保存 type
      role: 'user',        // 假設 FTS 搜索到的主要是內容
      content: content,
      timestamp: timestamp,
      cwd: null,
      gitBranch: null,
      syncedAt: '',
    });
  }
  
  return Array.from(sessionMap.values());
}

/**
 * 搜索會話
 */
export function searchSessions(query: string): SearchResult[] {
  const db = getDatabase();
  const pattern = `%${query}%`;
  
  const stmt = db.prepare(`
    SELECT * FROM claude_sessions_win
    WHERE 
      custom_title LIKE ? OR
      summary LIKE ? OR
      first_prompt LIKE ?
    ORDER BY modified_at DESC
    LIMIT 50
  `);
  
  const sessions = (stmt.all(pattern, pattern, pattern) as any[]).map(toCamelCaseSession);
  
  return sessions.map((session) => {
    let matchType: 'title' | 'firstPrompt' | 'message' = 'message';
    
    if (session.customTitle?.includes(query) || session.summary?.includes(query)) {
      matchType = 'title';
    } else if (session.firstPrompt?.includes(query)) {
      matchType = 'firstPrompt';
    }
    
    return {
      session,
      matchType,
    };
  });
}

/**
 * 綜合搜索（會話 + 消息）
 */
export function search(query: string): SearchResult[] {
  const sessionResults = searchSessions(query);
  const messageResults = searchMessages(query);
  
  // 合併結果，去重
  const resultMap = new Map<string, SearchResult>();
  
  for (const result of sessionResults) {
    resultMap.set(result.session.sessionId, result);
  }
  
  for (const result of messageResults) {
    if (!resultMap.has(result.session.sessionId)) {
      resultMap.set(result.session.sessionId, result);
    }
  }
  
  return Array.from(resultMap.values());
}

/**
 * 篩選會話
 */
export function filterSessions(options: FilterOptions): Session[] {
  const db = getDatabase();
  
  let sql = 'SELECT * FROM claude_sessions_win WHERE 1=1';
  const params: any[] = [];
  
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
  return (stmt.all(...params) as any[]).map(toCamelCaseSession);
}

/**
 * 獲取統計信息
 */
export function getStats() {
  const db = getDatabase();
  
  const sessionCount = db.prepare('SELECT COUNT(*) as count FROM claude_sessions_win').get() as { count: number };
  const messageCount = db.prepare('SELECT COUNT(*) as count FROM claude_messages_win').get() as { count: number };
  const userMessageCount = db.prepare('SELECT COUNT(*) as count FROM claude_messages_win WHERE role = "user"').get() as { count: number };
  
  const projects = db.prepare('SELECT DISTINCT project_path FROM claude_sessions_win').all() as Array<{ project_path: string }>;
  const branches = db.prepare('SELECT DISTINCT git_branch FROM claude_sessions_win WHERE git_branch IS NOT NULL').all() as Array<{ git_branch: string }>;
  
  return {
    totalSessions: sessionCount.count,
    totalMessages: messageCount.count,
    totalUserMessages: userMessageCount.count,
    projects: projects.map((p) => p.project_path),
    branches: branches.map((b) => b.git_branch),
  };
}
