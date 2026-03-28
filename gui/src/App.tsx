import React, { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { useNavigationStore } from './stores/useNavigationStore';
import { ToastContainer } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { GlobalProgressBar } from './components/common/GlobalProgressBar';
import { useAnalysisStore } from './stores/useAnalysisStore';

import { MobisWebGLAvatar } from './components/MobisWebGLAvatar';

// Page-level components — loaded on demand
const SessionsManager = lazy(() =>
  import('./components/sessions/SessionsManager').then(m => ({ default: m.SessionsManager }))
);
const ReportsManager = lazy(() =>
  import('./components/reports/ReportsManager').then(m => ({ default: m.ReportsManager }))
);
const WikiManager = lazy(() =>
  import('./components/wiki/WikiManager').then(m => ({ default: m.WikiManager }))
);
const KnowledgeManager = lazy(() =>
  import('./components/wiki/KnowledgeManager').then(m => ({ default: m.KnowledgeManager }))
);
const IssuesManager = lazy(() =>
  import('./components/wiki/IssuesManager').then(m => ({ default: m.IssuesManager }))
);
const SkillsDocsManager = lazy(() =>
  import('./components/wiki/SkillsDocsManager').then(m => ({ default: m.SkillsDocsManager }))
);
const Dashboard = lazy(() =>
  import('./components/dashboard/Dashboard').then(m => ({ default: m.Dashboard }))
);
const ProgressView = lazy(() =>
  import('./components/progress/ProgressView').then(m => ({ default: m.ProgressView }))
);
const InsightsManager = lazy(() =>
  import('./components/insights/InsightsManager').then(m => ({ default: m.InsightsManager }))
);
const SettingsPage = lazy(() =>
  import('./components/settings/SettingsPage').then(m => ({ default: m.SettingsPage }))
);

// Settings page is now in components/settings/SettingsPage.tsx

export const App: React.FC = () => {
  const { currentMode, theme } = useNavigationStore();

  // Sync theme to DOM on mount and changes
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keyboard shortcuts: Ctrl/Cmd + 1-9 to switch pages
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const order = useNavigationStore.getState().sidebarOrder;
        if (order[num - 1]) {
          useNavigationStore.getState().setMode(order[num - 1]);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const hasActiveJob = useAnalysisStore((s) => s.currentJob !== null);
  const petals = React.useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        className: `petal petal-${i % 3}`,
        style: {
          width: `${6 + ((i * 7) % 12)}px`,
          height: `${8 + ((i * 5) % 14)}px`,
          left: `${(i * 17) % 100}%`,
          opacity: 0.16 + (((i * 11) % 20) / 100),
          animationDuration: `${11 + (i % 7) * 2}s`,
          animationDelay: `${-(i * 1.3)}s`,
        } as React.CSSProperties,
      })),
    []
  );

  const renderContent = () => {
    switch (currentMode) {
      case 'skills-docs':
        return <SkillsDocsManager key="skills-docs" />;
      case 'dashboard':
        return <Dashboard key="dashboard" />;
      case 'progress':
        return <ProgressView key="progress" />;
      case 'sessions':
        return <SessionsManager key="sessions" />;
      case 'reports':
        return <ReportsManager key="reports" />;
      case 'insights':
        return <InsightsManager key="insights" />;
      case 'issues':
        return <IssuesManager key="issues" />;
      case 'wiki':
        return <WikiManager key="wiki" />;
      case 'knowledge':
        return <KnowledgeManager key="knowledge" />;
      case 'settings':
        return <SettingsPage key="settings" />;
      default:
        return <SkillsDocsManager key="skills-docs-default" />;
    }
  };

  return (
    <>
      <GlobalProgressBar />

      {/* Ambient Background Layer */}
      <div className="ambient-bg">
        <div className="ambient-blob blob-purple"></div>
        <div className="ambient-blob blob-sakura"></div>
        {petals.map((petal) => (
          <div key={petal.id} className={petal.className} style={petal.style}></div>
        ))}
      </div>

      <div className="app-container" style={{ paddingTop: hasActiveJob ? '36px' : '0' }}>
        <Sidebar />
        <main className="main-content">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-4">
                      <span className="material-icons text-4xl text-primary animate-spin">refresh</span>
                      <span className="text-sm text-[var(--color-morning-mist)]">載入中...</span>
                    </div>
                  </div>
                }>
                  {renderContent()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>

      {/* Toast Notifications */}
      <ToastContainer />

      {/* 3D AI Assistant Avatar */}
      <MobisWebGLAvatar />
    </>
  );
};

export default App;
