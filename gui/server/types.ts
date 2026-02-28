/**
 * Type definitions for Skills Switch GUI Backend
 */

// ========== Claude Sessions Types (from gui-react) ==========

export type SessionProvider = 'claude' | 'codex' | 'antigravity';

export interface Session {
  sessionId: string;
  provider: SessionProvider;
  projectPath: string;
  gitBranch: string | null;
  customTitle: string | null;
  summary: string | null;
  firstPrompt: string | null;
  messageCount: number;
  createdAt: string;
  modifiedAt: string;
  fileMtime: number | null;
  fullPath: string;
  isSidechain: boolean;
}

export interface Message {
  id: number;
  provider: SessionProvider;
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

export interface SessionGroup {
  date: string;
  sessions: Session[];
}

export interface SearchResult {
  session: Session;
  matchedMessages?: Message[];
  matchType: 'title' | 'firstPrompt' | 'message';
}

export interface FilterOptions {
  projectPath?: string;
  gitBranch?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  minMessageCount?: number;
}

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

// ========== Skills Management Types (NEW) ==========

export interface Skill {
  name: string;
  description: string;
  descriptionZh?: string | null;
  category: string;
}

export interface Profile {
  name: string;
  description: string;
  tool: string;
  skills: string[];
  plugins?: string[];
}

export interface SyncSkillsResult {
  foundSkills: number;
  updatedSkills: number;
  errors: string[];
}
