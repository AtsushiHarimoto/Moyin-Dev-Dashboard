export const queryKeys = {
  sessions: {
    all: ['sessions'] as const,
    list: (filters?: Record<string, unknown>) => ['sessions', 'list', filters] as const,
    detail: (id: string) => ['sessions', 'detail', id] as const,
    byDate: () => ['sessions', 'by-date'] as const,
  },
  skills: {
    all: ['skills'] as const,
    list: () => ['skills', 'list'] as const,
    profiles: () => ['skills', 'profiles'] as const,
  },
  reports: {
    all: ['reports'] as const,
    list: (archived?: boolean) => ['reports', 'list', { archived }] as const,
    detail: (id: string) => ['reports', 'detail', id] as const,
  },
  insights: {
    all: ['insights'] as const,
    list: () => ['insights', 'list'] as const,
    detail: (id: string) => ['insights', 'detail', id] as const,
  },
  wiki: {
    all: ['wiki'] as const,
    tree: (category: string) => ['wiki', 'tree', category] as const,
    content: (id: string) => ['wiki', 'content', id] as const,
  },
  dashboard: {
    stats: () => ['dashboard', 'stats'] as const,
    health: () => ['dashboard', 'health'] as const,
  },
  messages: {
    all: ['messages'] as const,
    bySession: (sessionId: string) => ['messages', sessionId] as const,
    search: (query: string) => ['messages', 'search', query] as const,
  },
} as const;
