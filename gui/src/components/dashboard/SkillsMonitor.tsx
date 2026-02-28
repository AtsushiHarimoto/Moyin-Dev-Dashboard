import { useMemo } from 'react';
import clsx from 'clsx';
import { useI18n } from '../../i18n';
import type { Skill } from '../../types';

function stableVersion(name: string): string {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return `${(Math.abs(hash) % 5) + 1}.0`;
}

interface SkillsMonitorProps {
  skills: Skill[];
  enabledSkills: string[];
}

export function SkillsMonitor({ skills, enabledSkills }: SkillsMonitorProps) {
  const { t } = useI18n();
  // Group skills by category
  const groupedSkills = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, skill) => {
      const category = skill.category || 'Other';
      (acc[category] ??= []).push(skill);
      return acc;
    }, {});
  }, [skills]);

  // Sort categories
  const categories = useMemo(() => 
    Object.keys(groupedSkills).sort((a, b) => {
        if (a === '前端開發' || a === 'Frontend') return -1;
        if (b === '前端開發' || b === 'Frontend') return 1;
        return a.localeCompare(b);
    }), 
  [groupedSkills]);

  return (
    <div className="h-full w-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/50 hover:scrollbar-thumb-primary/80 relative">
      {/* Page Title - Sticky Header */}
      <div className="sticky top-0 bg-background-dark/95 backdrop-blur-xl z-50 px-8 py-6 border-b border-white/5 flex items-center justify-between shadow-2xl shadow-background-dark/50">
          <div>
            <h2 className="text-4xl font-bold text-[var(--color-moonlight)] tracking-widest uppercase glow-text">{t('dashboard.monitor.title')}</h2>
            <div className="flex items-center gap-3 mt-2">
                <p className="text-sm text-[var(--color-morning-mist)] font-mono tracking-[0.2em] uppercase opacity-70">
                {t('dashboard.monitor.subtitle')}
                </p>
                <div className="h-px w-12 bg-white/10"></div>
                <p className="text-xs text-primary/80 font-mono tracking-widest">
                    {t('dashboard.monitor.activeModules', { count: enabledSkills.length })}
                </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[var(--color-dark-purple)]/40 px-6 py-3 rounded-full border border-emerald-500/30 backdrop-blur-md">
             <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
             <span className="text-base font-bold text-emerald-400 tracking-wider text-glow">{t('dashboard.monitor.live')}</span>
          </div>
      </div>

      {/* Content Container with Padding */}
      <div className="p-8 pb-40 space-y-16 max-w-[1920px] mx-auto">
        {categories.map(category => (
          <div key={category} className="space-y-6">
            {/* Category Header - Sticky Top under main header */}
            <div className="flex items-center gap-6 sticky top-32 z-40 py-2 -mx-4 px-4 backdrop-blur-sm rounded-lg w-fit mix-blend-screen">
               <h3 className="text-3xl font-bold tracking-[0.1em] text-[var(--color-moonlight)] flex items-center gap-4">
                 <div className="w-2 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full shadow-[0_0_15px_var(--color-sakura-pink)]"></div>
                 {category}
               </h3>
               <div className="h-px w-24 bg-gradient-to-r from-white/20 to-transparent"></div>
               <span className="text-sm font-mono text-[var(--color-morning-mist)] font-bold bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  {t('dashboard.monitor.modules', { count: groupedSkills[category].length })}
               </span>
            </div>

            {/* Matrix Grid - Wider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {groupedSkills[category].map(skill => {
                const isEnabled = enabledSkills.includes(skill.name);
                
                return (
                  <div
                    key={skill.name}
                    className={clsx(
                      "relative p-6 rounded-2xl transition-all duration-300 border backdrop-blur-sm group overflow-hidden flex flex-col justify-between min-h-[140px]",
                      isEnabled 
                        ? "bg-gradient-to-br from-primary/10 to-primary/20 border-primary/40 shadow-[0_0_20px_var(--color-sakura-glow)]"
                        : "bg-white/5 border-white/5 opacity-60 hover:opacity-100 hover:bg-white/10"
                    )}
                  >
                    {/* Active Indicator Bar */}
                    {isEnabled && (
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary shadow-[0_0_10px_currentColor]"></div>
                    )}

                    <div className="flex justify-between items-start pl-2">
                       {/* Skill Name */}
                      <div className="flex-1 pr-4">
                          <span className={clsx(
                            "block text-xl font-bold leading-tight transition-colors mb-2 break-all",
                            isEnabled ? "text-[var(--color-moonlight)] text-glow" : "text-[var(--color-moonlight)]"
                          )} title={skill.name}>
                            {skill.name}
                          </span>
                          
                          {/* Description (Truncated) */}
                          <p className="text-xs text-[var(--color-morning-mist)] line-clamp-2 leading-relaxed font-medium">
                            {skill.description || skill.descriptionZh || t('dashboard.monitor.noDescription')}
                          </p>
                      </div>

                      {/* Status Badge */}
                      <span className={clsx(
                        "text-[10px] font-mono font-bold tracking-wider px-2 py-1 rounded border uppercase shrink-0",
                        isEnabled 
                          ? "text-primary border-primary/40 bg-primary/10 shadow-[0_0_10px_var(--color-sakura-glow)]"
                          : "text-[var(--color-morning-mist)] border-[var(--color-mist-purple)]/30 bg-[var(--color-dark-purple)]/20"
                      )}>
                        {isEnabled ? t('dashboard.monitor.active') : t('dashboard.monitor.offline')}
                      </span>
                    </div>

                    
                    {/* Bottom Meta */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center pl-2 opacity-50 group-hover:opacity-100 transition-opacity">
                         <span className="text-[10px] font-mono text-[var(--color-morning-mist)]">v{stableVersion(skill.name)}.24</span>
                         {isEnabled && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>}
                    </div>

                    {/* Active Background Effect */}
                    {isEnabled && (
                       <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary/20 blur-3xl rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
