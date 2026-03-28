/**
 * SessionsManager 組件
 * 重構為高端 split-pane 佈局
 */

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useSessions, useSyncSessions } from '../../hooks/useSessions';
import { SessionList } from './SessionList';
import { SessionDetail } from './SessionDetail';
import { HistoryTabs, type HistoryProvider } from './HistoryTabs';
import { useI18n } from '../../i18n';
import { motion, AnimatePresence } from 'framer-motion';

export function SessionsManager() {
  const [activeProvider, setActiveProvider] = useState<HistoryProvider>('claude');
  const { data: sessions, isLoading: isLoadingSessions } = useSessions(activeProvider);
  const { mutate: sync, isPending: isSyncing } = useSyncSessions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; total: number } | null>(null);
  const { t } = useI18n();

  const filteredSessions = useMemo(() => {
    if (!sessions || !searchQuery) return sessions || [];
    const q = searchQuery.toLowerCase();
    return sessions.filter(session =>
      (session.customTitle?.toLowerCase() || '').includes(q) ||
      (session.summary?.toLowerCase() || '').includes(q) ||
      (session.firstPrompt?.toLowerCase() || '').includes(q)
    );
  }, [sessions, searchQuery]);

  const selectedSession = sessions?.find((session) => session.sessionId === selectedSessionId) || null;

  useEffect(() => {
    setSearchQuery('');
  }, [activeProvider]);

  const handleSync = () => {
    setSyncProgress({ processed: 0, total: 0 });
    sync(
      {
        provider: activeProvider,
        batchSize: 12,
        onProgress: (progress) => {
          setSyncProgress({
            processed: progress.processedSessions,
            total: progress.totalSessions,
          });
        },
      },
      {
        onSettled: () => {
          setSyncProgress(null);
        },
      }
    );
  };

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Left Column: Session List */}
      <aside className="w-80 lg:w-96 border-r border-moonlight/5 flex flex-col bg-surface-dark/30 backdrop-blur-sm shrink-0">
        {/* Header Area */}
        <div className="h-20 border-b border-moonlight/5 px-6 flex items-center justify-between shrink-0">
           <h2 className="text-lg font-bold text-[var(--color-moonlight)] tracking-tight">{t('sessions.detail.title')}</h2>
           <button
             onClick={handleSync}
             disabled={isSyncing}
             className="text-cloud-mist hover:text-primary transition-colors disabled:opacity-30"
           >
             <span className={clsx("material-icons text-[20px]", isSyncing && "animate-spin")}>sync</span>
           </button>
        </div>

        {/* Search & Tabs */}
        <div className="p-4 space-y-4 border-b border-moonlight/5 bg-[var(--color-dark-purple)]/10">
           <div className="relative group">
              <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-morning-mist)] group-focus-within:text-primary transition-colors text-[20px]">search</span>
              <input
                 className="w-full bg-moonlight/5 border border-moonlight/10 rounded-xl py-2 pl-10 pr-4 text-xs text-[var(--color-moonlight)] placeholder-[var(--color-cloud-mist)] focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all font-medium"
                 placeholder={t('sessions.searchPlaceholder')}
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           <HistoryTabs activeProvider={activeProvider} onChange={setActiveProvider} />
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-hidden">
           {isLoadingSessions ? (
               <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                   <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                   <span className="text-[10px] font-bold tracking-widest uppercase">{t('sessions.loading')}</span>
               </div>
           ) : (
               <SessionList
                 sessions={filteredSessions}
                 selectedSessionId={selectedSessionId}
                 onSelectSession={setSelectedSessionId}
               />
           )}
        </div>

        {/* Sync Progress Overlay */}
        {syncProgress && (
           <div className="p-3 bg-primary/20 border-t border-primary/30">
              <div className="flex justify-between items-center mb-1.5">
                 <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t('sessions.syncing', { processed: syncProgress.processed, total: syncProgress.total })}</span>
                 <span className="text-[10px] font-mono text-primary font-bold">{Math.round((syncProgress.processed / (syncProgress.total || 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-moonlight/10 h-1 rounded-full overflow-hidden">
                 <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(syncProgress.processed / (syncProgress.total || 1)) * 100}%` }}
                    className="bg-primary h-full"
                 />
              </div>
           </div>
        )}
      </aside>

      {/* Right Column: Message Detail View */}
      <main className="flex-1 flex flex-col relative bg-twilight-gradient bg-no-repeat bg-fixed overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedSession ? (
            <motion.div
              key={selectedSession.sessionId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              <SessionDetail
                session={selectedSession}
                provider={activeProvider}
                onBack={() => setSelectedSessionId(null)}
              />
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30 select-none">
                <span className="material-icons text-8xl mb-6 text-[var(--color-smoke-purple)]">forum</span>
                <h3 className="text-xl font-bold uppercase tracking-[0.3em] text-[var(--color-cloud-mist)]">{t('reports.detail.empty')}</h3>
                <p className="text-sm mt-2 max-w-xs">{t('sessions.empty.description')}</p>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Sync Action (Bottom Right) */}
        <div className="absolute bottom-8 right-8 z-40">
           <button
             onClick={handleSync}
             disabled={isSyncing}
             className="sakura-btn flex items-center gap-2.5 px-6 py-3 rounded-full font-bold group disabled:grayscale disabled:opacity-50"
           >
             <span className={clsx("material-icons text-lg transition-transform duration-500", isSyncing && "animate-spin")}>sync</span>
             <span className="text-sm tracking-widest uppercase">{t('sessions.sync')}</span>
           </button>
        </div>
      </main>
    </div>
  );
}
