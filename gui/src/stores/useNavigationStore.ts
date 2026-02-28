import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from './safeStorage';

export type NavigationMode = 'skills-docs' | 'dashboard' | 'progress' | 'skills' | 'sessions' | 'reports' | 'insights' | 'wiki' | 'knowledge' | 'issues' | 'settings';

export type ThemeId = 'dark' | 'sakura' | 'tokyo-night' | 'hack' | 'eye-care';

export const THEMES: { id: ThemeId; label: string; icon: string; primary: string; bg: string }[] = [
  { id: 'dark',        label: '霓虹紫夜',  icon: 'dark_mode',      primary: '#a855f7', bg: '#0f051a' },
  { id: 'sakura',      label: '櫻花',      icon: 'local_florist',  primary: '#f472b6', bg: '#fdeff4' },
  { id: 'tokyo-night', label: '東京夜',    icon: 'nights_stay',    primary: '#7aa2f7', bg: '#1a1b26' },
  { id: 'hack',        label: '黑客終端',  icon: 'terminal',       primary: '#00ff41', bg: '#0d1117' },
  { id: 'eye-care',    label: '護眼模式',  icon: 'visibility',     primary: '#795548', bg: '#f5f1e6' },
];

export const DEFAULT_SIDEBAR_ORDER: NavigationMode[] = [
  'dashboard', 'progress', 'skills-docs', 'skills', 'sessions',
  'reports', 'insights', 'issues', 'wiki', 'knowledge',
];

interface NavigationState {
  currentMode: NavigationMode;
  sidebarCollapsed: boolean;
  sidebarOrder: NavigationMode[];
  theme: ThemeId;
  setMode: (mode: NavigationMode) => void;
  toggleSidebar: () => void;
  setSidebarOrder: (order: NavigationMode[]) => void;
  resetSidebarOrder: () => void;
  setTheme: (theme: ThemeId) => void;
}

const safeStorage = createSafeStorage('NavigationStore');

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      currentMode: 'skills',
      sidebarCollapsed: false,
      sidebarOrder: DEFAULT_SIDEBAR_ORDER,
      theme: 'dark',

      setMode: (mode: NavigationMode) => set({ currentMode: mode }),

      toggleSidebar: () => set((state) => ({
        sidebarCollapsed: !state.sidebarCollapsed,
      })),

      setSidebarOrder: (order: NavigationMode[]) => set({ sidebarOrder: order }),

      resetSidebarOrder: () => set({ sidebarOrder: DEFAULT_SIDEBAR_ORDER }),

      setTheme: (theme: ThemeId) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
    }),
    {
      name: 'moyin-navigation-storage',
      storage: safeStorage,
    }
  )
);
