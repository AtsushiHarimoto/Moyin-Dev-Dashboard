
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useI18n } from '../../i18n';
import type { Skill } from '../../types';

function stableVersion(name: string): string {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return `${(Math.abs(hash) % 5) + 1}.0`;
}

interface SkillsMatrixProps {
  skills: Skill[];
  enabledSkills: string[];
  onToggle: (skillName: string) => void;
  className?: string;
}

export function SkillsMatrix({ skills, enabledSkills, onToggle, className }: SkillsMatrixProps) {
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
    <div className={clsx("space-y-8", className)}>
      {categories.map(category => (
        <div key={category} className="space-y-3">
          {/* Category Header with Neon Line */}
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-bold tracking-[0.2em] text-primary/80 uppercase glow-text">
              {category}
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent"></div>
          </div>

          {/* Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {groupedSkills[category].map(skill => {
              const isEnabled = enabledSkills.includes(skill.name);
              
              return (
                <motion.button
                  key={skill.name}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onToggle(skill.name)}
                  className={clsx(
                    "relative h-20 p-3 flex flex-col justify-between items-start rounded-xl text-left transition-all duration-300",
                    "border backdrop-blur-md overflow-hidden group",
                    isEnabled 
                      ? "bg-primary/10 border-primary/60 shadow-[0_0_15px_var(--color-sakura-glow)]"
                      : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 opacity-60 hover:opacity-100"
                  )}
                >
                  {/* Neon Glow Background for Active */}
                  {isEnabled && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-50" />
                  )}

                  {/* Status Indicator */}
                  <div className="flex justify-between w-full items-start z-10">
                    <div className={clsx(
                      "w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]",
                      isEnabled ? "bg-primary text-primary" : "bg-[var(--color-smoke-purple)]/50 text-[var(--color-smoke-purple)]"
                    )} />
                    {isEnabled && <span className="text-[9px] font-bold text-primary tracking-wider">{t('dashboard.matrix.on')}</span>}
                  </div>

                  {/* Skill Name */}
                  <div className="z-10 w-full truncate">
                    <span className={clsx(
                      "block text-xs font-bold truncate transition-colors",
                      isEnabled ? "text-[var(--color-moonlight)] text-glow" : "text-[var(--color-morning-mist)] group-hover:text-[var(--color-moonlight)]"
                    )}>
                      {skill.name}
                    </span>
                    <span className="text-[9px] text-[var(--color-morning-mist)] truncate block mt-0.5">
                       {/* Show short description fallback or just ID/Ver */}
                       v{stableVersion(skill.name)}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
