/**
 * SkillCard 組件
 * 採用高端玻璃擬態設計
 */

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Skill } from '../../types';

/** 分類關鍵字 -> Material Icon 對應表 */
const CATEGORY_ICON_MAP: Record<string, string> = {
  Code: 'terminal',
  前端: 'web',
  後端: 'dns',
  設計: 'palette',
  需求: 'description',
  測試: 'bug_report',
  Creative: 'edit_note',
};

const DEFAULT_ICON = 'hub';

/**
 * 用途：根據技能分類取得對應的 Material Icon 名稱
 *
 * @param category 技能分類名稱，可能為完整名或包含關鍵字
 *                 Category name, may be exact or contain a keyword.
 * @returns        對應的 Material Icon 名稱，無匹配時回傳 'hub'
 *                 Matching icon name, defaults to 'hub'.
 */
function getCategoryIcon(category: string): string {
  for (const [keyword, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (category === keyword || category.includes(keyword)) {
      return icon;
    }
  }
  return DEFAULT_ICON;
}

interface SkillCardProps {
  skill: Skill;
  isSelected: boolean;
  onToggle: (skillId: string) => void;
  onNavigateToDoc: (skillName: string) => void;
}

export const SkillCard = forwardRef<HTMLDivElement, SkillCardProps>(
  ({ skill, isSelected, onToggle, onNavigateToDoc }, ref) => {
    const description = skill.descriptionZh?.trim() || skill.description || '該技能模組尚未配置詳細描述。';

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigateToDoc(skill.name);
      }
    };

    return (
      <motion.div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`查看 ${skill.name} 文檔`}
        whileHover={{ y: -4, borderColor: 'var(--color-glass-border)' }}
        whileTap={{ scale: 0.98 }}
        className={clsx(
          'glass-card rounded-2xl p-6 relative overflow-hidden group cursor-pointer h-full flex flex-col',
          isSelected && 'border-primary/40'
        )}
        onClick={() => onNavigateToDoc(skill.name)}
        onKeyDown={handleKeyDown}
      >
        {/* 選中狀態的氛圍裝飾 */}
        {isSelected && (
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
             <span className="material-icons text-6xl text-primary">auto_fix_high</span>
          </div>
        )}

        <div className="flex flex-col gap-4 relative z-10 h-full">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300",
              isSelected
                ? "bg-primary/20 text-primary border-primary/30 shadow-[0_0_15px_var(--color-sakura-glow)]"
                : "bg-moonlight/5 text-morning-mist border-moonlight/5 group-hover:border-moonlight/10"
            )}>
              <span className="material-icons">
                {getCategoryIcon(skill.category)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
               <h3 className={clsx(
                 "text-sm font-bold tracking-tight truncate mb-0.5 transition-colors",
                 isSelected ? "text-[var(--color-moonlight)] text-glow" : "text-[var(--color-moonlight)] group-hover:text-[var(--color-moonlight)]"
               )}>
                 {skill.name}
               </h3>
               <span className="text-[10px] text-[var(--color-morning-mist)] font-bold uppercase tracking-wider bg-[var(--color-mist-purple)]/40 px-2 py-0.5 rounded-full inline-block">
                 {skill.category || '其它'}
               </span>
            </div>
          </div>

          {/* Description */}
          <p className={clsx(
            "text-xs leading-relaxed line-clamp-3 mb-4",
            isSelected ? "text-[var(--color-moonlight)]" : "text-morning-mist"
          )}>
            {description}
          </p>

          {/* Toggle UI */}
          <div className="mt-auto pt-4 flex items-center justify-between">
            <span className={clsx(
              "text-[10px] font-bold tracking-widest uppercase",
              isSelected ? "text-primary" : "text-[var(--color-cloud-mist)]"
            )}>
              {isSelected ? 'Activated' : 'Inactive'}
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={isSelected}
              aria-label={`${isSelected ? '停用' : '啟用'} ${skill.name}`}
              className="relative inline-flex items-center cursor-pointer"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onToggle(skill.name);
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
              }}
            >
              <div className={clsx(
                 "w-10 h-5 rounded-full transition-all duration-300",
                 isSelected ? "bg-primary" : "bg-smoke-purple"
              )}>
                <motion.div
                  initial={false}
                  animate={{ x: isSelected ? 20 : 4 }}
                  className="absolute top-[4px] bg-moonlight rounded-full shadow-lg"
                  style={{ width: '12px', height: '12px' }}
                />
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }
);

SkillCard.displayName = 'SkillCard';
