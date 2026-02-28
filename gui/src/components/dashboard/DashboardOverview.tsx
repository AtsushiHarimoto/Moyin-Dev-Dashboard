import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { SessionsTrendCard } from './SessionsTrendCard';
import { InsightsWidget } from './InsightsWidget';
import { dashboardApi } from '../../utils/api';
import { useI18n } from '../../i18n';
import type { Skill, Profile } from '../../types';

interface DashboardOverviewProps {
  skills: Skill[];
  currentProfile: Profile | null;
  modifiedSkills: string[];
}

export function DashboardOverview({ skills, currentProfile, modifiedSkills }: DashboardOverviewProps) {
  const { t } = useI18n();
  const activeCount = modifiedSkills.length;
  const totalCount = skills.length;
  const usagePercentage = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30_000,
  });

  const systemStatus = stats?.system?.status === 'healthy' ? t('dashboard.overview.online') : '—';
  const systemLabel = stats?.system?.status === 'healthy' ? t('dashboard.overview.allNominal') : t('dashboard.overview.checking');
  const isHealthy = stats?.system?.status === 'healthy';

  const sessions = stats?.sessions;
  const issues = stats?.issues;
  const wiki = stats?.wiki;

  return (
    <div className="h-full w-full p-8 flex flex-col gap-8 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/50 hover:scrollbar-thumb-primary/80 pb-24">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--color-moonlight)] tracking-tight">{t('dashboard.overview.pageTitle')}</h1>
          <p className="text-sm text-[var(--color-morning-mist)] font-mono tracking-widest uppercase mt-1">
            {t('dashboard.overview.missionControl')}
          </p>
        </div>
        <div className="text-right">
           <div className="text-3xl font-bold text-primary text-glow">{currentProfile?.name || 'N/A'}</div>
           <div className="text-[10px] text-[var(--color-morning-mist)] uppercase tracking-[0.2em]">{t('dashboard.overview.activeProfile')}</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Card 1: Active Skills */}
         <motion.div
           whileHover={{ scale: 1.02 }}
           className="glass-card rounded-2xl p-6 border-l-4 border-l-primary relative overflow-hidden group"
         >
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <span className="material-icons text-8xl text-primary">extension</span>
            </div>
            <h3 className="text-xs font-bold text-[var(--color-morning-mist)] uppercase tracking-widest mb-2">{t('dashboard.overview.activeSkills')}</h3>
            <div className="text-5xl font-bold text-[var(--color-moonlight)] font-mono tracking-tighter">
              {activeCount}
              <span className="text-lg text-[var(--color-morning-mist)] ml-2 font-normal">/ {totalCount}</span>
            </div>
            <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-primary shadow-[0_0_10px_currentColor]" style={{ width: `${usagePercentage}%` }}></div>
            </div>
         </motion.div>

         {/* Card 2: System Status */}
         <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-2xl p-6 border-l-4 border-l-emerald-500 relative overflow-hidden group"
         >
             <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <span className="material-icons text-8xl text-emerald-500">dns</span>
            </div>
            <h3 className="text-xs font-bold text-[var(--color-morning-mist)] uppercase tracking-widest mb-2">{t('dashboard.overview.systemStatus')}</h3>
            <div className="text-5xl font-bold text-[var(--color-moonlight)] font-mono tracking-tighter">
              {systemStatus}
            </div>
            <div className={`mt-2 text-xs font-bold flex items-center gap-2 ${isHealthy ? 'text-emerald-400' : 'text-[var(--color-morning-mist)]'}`}>
               {isHealthy && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
               {systemLabel}
            </div>
         </motion.div>

         {/* Card 3: Sessions */}
         <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-2xl p-6 border-l-4 border-l-blue-500 relative overflow-hidden group"
         >
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <span className="material-icons text-8xl text-blue-500">forum</span>
            </div>
            <h3 className="text-xs font-bold text-[var(--color-morning-mist)] uppercase tracking-widest mb-2">{t('dashboard.overview.sessions')}</h3>
            <div className="text-5xl font-bold text-[var(--color-moonlight)] font-mono tracking-tighter">
              {sessions?.totalSessions ?? '—'}
            </div>
            <div className="mt-2 text-xs text-blue-400">
               {t('dashboard.overview.sessionsSummary', { week: sessions?.thisWeek ?? '—', messages: sessions?.totalMessages?.toLocaleString() ?? '—' })}
            </div>
         </motion.div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Trend Chart (Main) */}
         <div className="lg:col-span-2 h-full min-h-[300px]">
            <SessionsTrendCard data={{
                totalSessions: sessions?.totalSessions ?? 0,
                totalMessages: sessions?.totalMessages ?? 0,
                thisWeek: sessions?.thisWeek ?? 0,
                trend: sessions?.trend ?? []
            }} />
         </div>

         {/* Secondary Stats or Info */}
         <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
               <h3 className="text-xs font-bold text-[var(--color-morning-mist)] uppercase tracking-widest mb-4">{t('dashboard.overview.quickInsights')}</h3>
               <ul className="space-y-6">
                  <li className="flex items-center justify-between border-b border-white/5 pb-2">
                     <div className="flex flex-col">
                        <span className="text-sm text-[var(--color-moonlight)]">{t('dashboard.overview.projectTasks')}</span>
                        <span className="text-[10px] text-[var(--color-morning-mist)] uppercase">{t('dashboard.overview.todoDoingDone')}</span>
                     </div>
                     <span className="text-2xl font-bold text-[var(--color-moonlight)] font-mono">
                       {issues ? `${issues.todo}/${issues.doing}/${issues.done}` : '—'}
                     </span>
                  </li>
                  <li className="flex items-center justify-between border-b border-white/5 pb-2">
                     <div className="flex flex-col">
                        <span className="text-sm text-[var(--color-moonlight)]">{t('dashboard.overview.projectDocs')}</span>
                        <span className="text-[10px] text-[var(--color-morning-mist)] uppercase">{t('dashboard.overview.wikiProjects')}</span>
                     </div>
                     <span className="text-2xl font-bold text-[var(--color-moonlight)] font-mono">
                       {wiki?.projects ?? '—'}
                     </span>
                  </li>
                  <li className="flex items-center justify-between border-b border-white/5 pb-2">
                     <div className="flex flex-col">
                        <span className="text-sm text-[var(--color-moonlight)]">{t('dashboard.overview.knowledgeBase')}</span>
                        <span className="text-[10px] text-[var(--color-morning-mist)] uppercase">{t('dashboard.overview.indexedItems')}</span>
                     </div>
                     <span className="text-2xl font-bold text-primary font-mono text-glow">
                       {wiki?.knowledge ?? '—'}
                     </span>
                  </li>
               </ul>
            </div>
         </div>
      </div>

      {/* AI Insights Widget */}
      <InsightsWidget />
    </div>
  );
}
