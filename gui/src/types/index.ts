/**
 * Claude Code 會話數據類型定義
 */

export type SessionProvider = 'claude' | 'codex';

/**
 * 會話元數據（對應 claude_sessions_win 表）
 */
export interface Session {
  id?: number;
  sessionId: string;
  provider?: SessionProvider;
  projectPath: string;
  gitBranch: string | null;
  customTitle: string | null;
  summary: string | null;
  firstPrompt: string | null;
  messageCount: number;
  createdAt: string;
  modifiedAt: string;
  fileMtime: number;
  fullPath: string;
  isSidechain: boolean;
  syncedAt?: string;
}

/**
 * 消息詳情（對應 claude_messages_win 表）
 */
export interface Message {
  id: number;
  provider?: SessionProvider;
  sessionId: string;
  messageUuid: string;
  parentUuid: string | null;
  messageType: 'user' | 'assistant';
  role: 'user' | 'assistant';
  content: string | null;
  timestamp: string;
  cwd: string | null;
  gitBranch: string | null;
  syncedAt: string;
}

/**
 * 會話分組（按日期）
 */
export interface SessionGroup {
  date: string;
  sessions: Session[];
}

/**
 * 搜索結果
 */
export interface SearchResult {
  session: Session;
  matchedMessages?: Message[];
  matchType: 'title' | 'firstPrompt' | 'message';
}

/**
 * 篩選條件
 */
export interface FilterOptions {
  projectPath?: string;
  gitBranch?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  minMessageCount?: number;
}

/**
 * 導出用戶提問格式
 */
export interface ExportedQuestion {
  timestamp: string;
  sessionId: string;
  sessionTitle: string;
  projectPath: string;
  gitBranch: string | null;
  question: string;
}

export interface ExportData {
  exportedAt: string;
  platform: 'Windows' | 'Mac';
  totalQuestions: number;
  questions: ExportedQuestion[];
}

/**
 * Skills & Profiles
 */
export interface Skill {
  name: string;
  description: string;
  descriptionZh?: string | null;
  category: string;
}

export interface Profile {
  name: string;
  description?: string;
  skills: string[];
}

export interface ProfileSummary {
  name: string;
  description: string;
  skillCount: number;
}

export interface SyncSkillsResult {
  foundSkills: number;
  updatedSkills: number;
  errors: string[];
}

export interface ReportItem {
  id: string;
  name: string;
  relativePath: string;
  ext: string;
  size: number;
  updatedAt: string;
  archived: boolean;
  isRead: boolean;
  snippet: string;
}

export interface ReportDetail extends ReportItem {
  content: string;
  insights?: {
    summary: string;
    items: import('../utils/api').TrendItem[];
    adopt: string[];
    trial: string[];
    assess: string[];
    hold: string[];
  } | null;
}

/**
 * Wiki 相關類型
 */
export interface WikiCategory {
  id: string;
  label: string;
  path: string;
}

export interface WikiProject {
  id: string;
  name: string;
  path: string;
}

export interface WikiFile {
  id: string;
  name: string;
  path: string;
  size: number;
  updatedAt: string;
}

export interface WikiContent {
  content: string;
  name: string;
  updatedAt: string;
  size: number;
}
