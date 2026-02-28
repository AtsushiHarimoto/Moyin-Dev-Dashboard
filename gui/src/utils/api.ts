/**
 * API 客戶端
 * 與後端 Express 服務器通信（基於 @moyin/net-client）
 */

import {
  configure,
  fetchRequest,
  type HttpMethod,
  NetHttpError,
} from '@moyin/net-client';
import type {
  Session,
  Message,
  SessionGroup,
  SearchResult,
  Skill,
  Profile,
  ProfileSummary,
  SessionProvider,
  ReportItem,
  ReportDetail,
  WikiCategory,
  WikiProject,
  WikiFile,
  WikiContent,
} from '../types';

configure({ baseUrl: '/api' });

/**
 * Analysis 類型 (Hermit Purple 整合)
 */
export interface AnalysisEvent {
  jobId: string;
  status: 'starting' | 'step_1_scraping' | 'step_2_auditing' | 'step_3_reporting' | 'completed' | 'cancelled' | 'failed';
  step: number;
  totalSteps: number;
  message: string;
  progress: number;
  timestamp: string;
}

export interface AnalysisJob {
  id: string;
  status: string;
  keywords: string;
  days: number;
  scrape_count: number;
  audit_count: number;
  report_md: string | null;
  insights_json: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface TrendItem {
  name: string;
  ring: 'adopt' | 'trial' | 'assess' | 'hold';
  quadrant: 'techniques' | 'tools' | 'platforms' | 'languages';
  trendDirection: 'rising' | 'stable' | 'declining';
  confidence: number;
  signal: string;
}

export interface AnalysisInsights {
  reportDate: string;
  summary: string;
  adopt: string[];
  trial: string[];
  assess: string[];
  hold: string[];
  items: TrendItem[];
}

/**
 * API 響應類型
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  code?: string;
}

/**
 * API 錯誤類型
 */
class ApiError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * 通用 API 請求函數（基於 @moyin/net-client）
 */
async function apiRequest<T>(
  endpoint: string,
  options?: ApiRequestOptions
): Promise<T> {
  let result: ApiResponse<T>;

  try {
    const response = await fetchRequest<ApiResponse<T>>({
      method: options?.method ?? 'GET',
      url: endpoint,
      body: options?.body,
      ...(options?.timeoutMs && { timeoutMs: options.timeoutMs }),
    });
    result = response.data;
  } catch (err) {
    if (err instanceof NetHttpError) {
      throw new ApiError(
        `API error ${err.httpStatus}: ${err.message}`,
        undefined,
        err.httpStatus,
      );
    }
    throw err;
  }

  if (!result.success) {
    throw new ApiError(result.error || 'API request failed', result.code);
  }

  return result.data as T;
}

/**
 * Stats 類型
 */
interface StatsData {
  totalSessions: number;
  totalMessages: number;
  totalUserMessages: number;
  projects: string[];
  branches: string[];
}

function providerQuery(provider: SessionProvider): string {
  return `provider=${encodeURIComponent(provider)}`;
}

/**
 * 會話 API
 */
export const sessionsApi = {
  getAll: (provider: SessionProvider = 'claude') =>
    apiRequest<Session[]>(`/sessions?${providerQuery(provider)}`),

  getByDate: (provider: SessionProvider = 'claude') =>
    apiRequest<SessionGroup[]>(`/sessions/by-date?${providerQuery(provider)}`),

  getById: (id: string, provider: SessionProvider = 'claude') =>
    apiRequest<Session>(`/sessions/${encodeURIComponent(id)}?${providerQuery(provider)}`),

  getStats: (provider: SessionProvider = 'claude') =>
    apiRequest<StatsData>(`/sessions/stats/summary?${providerQuery(provider)}`),
};

/**
 * 消息 API
 */
export const messagesApi = {
  getBySession: (sessionId: string, provider: SessionProvider = 'claude') =>
    apiRequest<Message[]>(`/messages/${encodeURIComponent(sessionId)}?${providerQuery(provider)}`),

  search: (query: string, provider: SessionProvider = 'claude') =>
    apiRequest<SearchResult[]>(`/messages/search?${providerQuery(provider)}&q=${encodeURIComponent(query)}`),

};

/**
 * 同步 API
 */
export const syncApi = {
  syncAll: (provider: SessionProvider = 'claude', options?: { cursor?: number; batchSize?: number }) => {
    const params = new URLSearchParams();
    params.set('provider', provider);
    if (typeof options?.cursor === 'number') params.set('cursor', String(options.cursor));
    if (typeof options?.batchSize === 'number') params.set('batchSize', String(options.batchSize));
    const query = params.toString();

    return apiRequest<{
      sessions: { synced: number; updated: number };
      messages: {
        synced: number;
        backfilledSessions?: number;
        processedSessions?: number;
        totalSessions?: number;
        hasMore?: boolean;
        nextCursor?: number | null;
      };
      errors: string[];
    }>(`/sync/all${query ? `?${query}` : ''}`, {
      method: 'POST',
    });
  },

};

/**
 * 導出 API
 */
export const exportApi = {
  exportSession: (sessionId: string, provider: SessionProvider = 'claude', outputPath?: string) =>
    apiRequest<{ filePath: string }>(`/export/session/${encodeURIComponent(sessionId)}?${providerQuery(provider)}`, {
      method: 'POST',
      body: { outputPath },
    }),

  exportSessionAsMarkdown: (sessionId: string, provider: SessionProvider = 'claude', outputPath?: string) =>
    apiRequest<{ filePath: string }>(`/export/session/${encodeURIComponent(sessionId)}/markdown?${providerQuery(provider)}`, {
      method: 'POST',
      body: { outputPath },
    }),
};

/**
 * Skills API
 */
export const skillsApi = {
  getAll: () => apiRequest<Skill[]>('/skills'),

  getCategories: () => apiRequest<string[]>('/skills/categories'),

  getProfiles: () => apiRequest<ProfileSummary[]>('/skills/profiles'),

  getProfile: (name: string) => apiRequest<Profile>(`/skills/profiles/${encodeURIComponent(name)}`),

  saveProfile: (name: string, data: Profile) =>
    apiRequest<{ message: string }>(`/skills/profiles/${encodeURIComponent(name)}`, {
      method: 'POST',
      body: data,
    }),

  syncSkills: () =>
    apiRequest<{ foundSkills: number; updatedSkills: number }>('/skills/sync', {
      method: 'POST',
    }),
};

/**
 * Reports API
 */
export const reportsApi = {
  list: (archived: boolean) =>
    apiRequest<ReportItem[]>(`/reports?archived=${archived}`),

  getDetail: (id: string) =>
    apiRequest<ReportDetail>(`/reports/${encodeURIComponent(id)}`),

  markAsRead: (id: string) =>
    apiRequest<{ reportId: string; readAt: string }>(`/reports/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    }),

  deleteReport: (id: string) =>
    apiRequest<{ reportId: string; deletedAt: string }>(`/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

/**
 * Wiki API
 */
export const wikiApi = {
  getCategories: () =>
    apiRequest<WikiCategory[]>('/wiki/categories'),

  getProjects: (category: string) =>
    apiRequest<WikiProject[]>(`/wiki/projects?category=${encodeURIComponent(category)}`),

  getFiles: (projectId: string) =>
    apiRequest<WikiFile[]>(`/wiki/files?projectId=${encodeURIComponent(projectId)}`),

  getContent: (fileId: string) =>
    apiRequest<WikiContent>(`/wiki/content?fileId=${encodeURIComponent(fileId)}`),

  syncWiki: () =>
    apiRequest<{ projects: number; files: number }>('/wiki/sync', { method: 'POST' }),
};

/**
 * Issues API — 唯讀模組，所有寫入操作已屏蔽
 */
export const issuesApi = {};

/**
 * Progress API
 */
export const progressApi = {
  getContent: () =>
    apiRequest<{ content: string; name: string; updatedAt: string; size: number }>('/progress'),
};

/**
 * Analysis API (Hermit Purple 整合)
 */
export const analysisApi = {
  start: (keywords?: string, days?: number, label?: string) =>
    apiRequest<{ jobId: string; status: string }>('/analysis/start', {
      method: 'POST',
      body: { keywords, days, label },
    }),

  cancel: () =>
    apiRequest<{ jobId: string; status: string }>('/analysis/cancel', {
      method: 'DELETE',
    }),

  getReports: () =>
    apiRequest<AnalysisJob[]>('/analysis/reports'),

  getLatestInsights: () =>
    apiRequest<AnalysisInsights | null>('/analysis/latest-insights'),

  batchStart: (presets: Array<{ label: string; keywords: string }>, days?: number) =>
    apiRequest<{ total: number; status: string }>('/analysis/batch-start', {
      method: 'POST',
      body: { presets, days },
    }),

  batchCancel: () =>
    apiRequest<{ status: string }>('/analysis/batch-cancel', {
      method: 'DELETE',
    }),
};

/**
 * Keywords API (動態熱詞系統)
 */
export interface KeywordPreset {
  id: number;
  category: string;
  icon: string;
  labelKey: string | null;
  descriptionKey: string | null;
  seedKeywords: string;
  discoveredKeywords: string;
  mergedKeywords: string;
  discoverScores: Array<{ keyword: string; score: number; frequency: number; source?: string }> | null;
  lastRefreshed: string | null;
  isBuiltin: boolean;
  seedCount: number;
  discoveredCount: number;
  createdAt: string;
  updatedAt: string;
}

export type KeywordRefreshJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface KeywordRefreshJob {
  id: string;
  status: KeywordRefreshJobStatus;
  useAi: boolean;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  progress: number;
  currentCategory: string | null;
  message: string;
  error: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  existing?: boolean;
}

export const keywordsApi = {
  getAll: () =>
    apiRequest<KeywordPreset[]>('/keywords'),

  refresh: (useAi?: boolean) =>
    apiRequest<KeywordRefreshJob>('/keywords/refresh', {
      method: 'POST',
      body: { useAi: useAi ?? true },
    }),

  getRefreshStatus: () =>
    apiRequest<KeywordRefreshJob | null>('/keywords/refresh/status'),

  getRefreshJob: (jobId: string) =>
    apiRequest<KeywordRefreshJob>(`/keywords/refresh/${encodeURIComponent(jobId)}`),

  update: (id: number, keywords: string) =>
    apiRequest<KeywordPreset>(`/keywords/${id}`, {
      method: 'PUT',
      body: { keywords },
    }),

  create: (category: string, icon: string, keywords: string) =>
    apiRequest<KeywordPreset>('/keywords', {
      method: 'POST',
      body: { category, icon, keywords },
    }),

  delete: (id: number) =>
    apiRequest<{ id: number }>(`/keywords/${id}`, {
      method: 'DELETE',
    }),
};

/**
 * Email API
 */
export const emailApi = {
  getStatus: () =>
    apiRequest<{ configured: boolean; from: string; to: string; toCount: number }>('/email/status'),

  sendTest: () =>
    apiRequest<{ message: string }>('/email/test', { method: 'POST' }),
};

/**
 * Dashboard API
 */
export const dashboardApi = {
  getStats: () =>
    apiRequest<{
      system: {
        status: string;
        databases: {
          sessions: boolean;
          skills: boolean;
          wiki: boolean;
        };
        uptime: number;
      };
      skills: {
        total: number;
        enabled: number;
        byProfile: Record<string, number>;
      };
      sessions: {
        totalSessions: number;
        totalMessages: number;
        thisWeek: number;
        trend: number[];
      };
      reports: {
        total: number;
        unread: number;
        latest: {
          name: string;
          updatedAt: string;
        } | null;
      };
      issues: {
        todo: number;
        doing: number;
        done: number;
        recentlyMoved: number;
      };
      wiki: {
        projects: number;
        knowledge: number;
        skillsDocs: number;
        recentUpdates: Array<{
          name: string;
          updatedAt: string;
        }>;
      };
    }>('/dashboard/stats'),
};
