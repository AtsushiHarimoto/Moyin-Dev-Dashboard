/**
 * 數據導出服務
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from './database';
import type { ExportData, ExportedQuestion } from '../types';

/**
 * 導出所有用戶提問為 JSON 格式
 */
export async function exportUserQuestions(
  outputPath?: string
): Promise<{ filePath: string; totalQuestions: number }> {
  const db = getDatabase();
  const platform = os.platform() === 'win32' ? 'Windows' : 'Mac';
  
  // 查詢所有用戶消息，按時間倒序
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
    WHERE m.role = 'user'
    ORDER BY m.timestamp DESC
  `);
  
  const rows = stmt.all() as Array<{
    timestamp: string;
    session_id: string;
    question: string;
    custom_title: string | null;
    summary: string | null;
    project_path: string;
    git_branch: string | null;
  }>;
  
  // 轉換為導出格式
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
  
  // 確定輸出路徑
  const defaultPath = path.join(
    process.cwd(),
    `user_questions_${Date.now()}.json`
  );
  const filePath = outputPath || defaultPath;
  
  // 寫入文件
  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  
  console.log(`Export complete: ${filePath}`);
  console.log(`   Total ${questions.length} user questions`);
  
  return {
    filePath,
    totalQuestions: questions.length,
  };
}

/**
 * 導出單個會話為 JSON 格式
 */
export async function exportSession(
  sessionId: string,
  outputPath?: string
): Promise<{ filePath: string; messageCount: number }> {
  const db = getDatabase();
  
  // 獲取會話信息
  const session = db
    .prepare('SELECT * FROM claude_sessions_win WHERE session_id = ?')
    .get(sessionId);
  
  if (!session) {
    throw new Error(`會話不存在: ${sessionId}`);
  }
  
  // 獲取所有消息
  const messages = db
    .prepare(`
      SELECT * FROM claude_messages_win
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `)
    .all(sessionId);
  
  const exportData = {
    session,
    messages,
    exportedAt: new Date().toISOString(),
  };
  
  // 確定輸出路徑
  const defaultPath = path.join(
    process.cwd(),
    `session_${sessionId}_${Date.now()}.json`
  );
  const filePath = outputPath || defaultPath;
  
  // 寫入文件
  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  
  console.log(`Session export complete: ${filePath}`);
  console.log(`   ${(messages as any[]).length} messages`);
  
  return {
    filePath,
    messageCount: (messages as any[]).length,
  };
}

/**
 * 導出會話為 Markdown 格式
 */
export async function exportSessionAsMarkdown(
  sessionId: string,
  outputPath?: string
): Promise<{ filePath: string }> {
  const db = getDatabase();
  
  // 獲取會話信息
  const session = db
    .prepare('SELECT * FROM claude_sessions_win WHERE session_id = ?')
    .get(sessionId) as any;
  
  if (!session) {
    throw new Error(`會話不存在: ${sessionId}`);
  }
  
  // 獲取所有消息
  const messages = db
    .prepare(`
      SELECT * FROM claude_messages_win
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `)
    .all(sessionId) as any[];
  
  // 生成 Markdown 內容
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
  
  // 確定輸出路徑
  const defaultPath = path.join(
    process.cwd(),
    `session_${sessionId}_${Date.now()}.md`
  );
  const filePath = outputPath || defaultPath;
  
  // 寫入文件
  fs.writeFileSync(filePath, markdown, 'utf-8');
  
  console.log(`Markdown export complete: ${filePath}`);
  
  return { filePath };
}
