/**
 * SkillsGrid 組件
 * 按分類分組顯示所有 skills 的網格佈局
 */

import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SkillCard } from './SkillCard';
import type { Skill } from '../../types';

interface SkillsGridProps {
  skills: Skill[];
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  onNavigateToDoc: (skillName: string) => void;
  searchQuery?: string;
  selectedCategory?: string | null;
}

export function SkillsGrid({
  skills,
  selectedSkills,
  onToggleSkill,
  onNavigateToDoc,
  searchQuery = '',
  selectedCategory = null,
}: SkillsGridProps) {
  /** 過濾並按分類分組 */
  const groupedSkills = useMemo(() => {
    let filtered = skills;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((skill) =>
        skill.name.toLowerCase().includes(query) ||
        (skill.descriptionZh?.toLowerCase() || '').includes(query) ||
        skill.description.toLowerCase().includes(query)
      );
    }

    if (selectedCategory && selectedCategory !== 'All') {
      filtered = filtered.filter((skill) => skill.category === selectedCategory);
    }

    return filtered.reduce<Record<string, Skill[]>>((groups, skill) => {
      const category = skill.category || '其它';
      (groups[category] ??= []).push(skill);
      return groups;
    }, {});
  }, [skills, searchQuery, selectedCategory]);

  const categories = useMemo(() =>
    Object.keys(groupedSkills).sort((a, b) => {
      if (a === '其它') return 1;
      if (b === '其它') return -1;
      return a.localeCompare(b);
    }),
    [groupedSkills]
  );

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-30 select-none">
        <span className="material-icons text-6xl mb-4 text-[var(--color-cloud-mist)]">search_off</span>
        <h3 className="text-xl font-bold uppercase tracking-[0.3em] text-[var(--color-cloud-mist)]">沒有找到符合條件的技能</h3>
        <p className="text-sm mt-2">請嘗試調整搜索條件或分類篩選</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {categories.map((category) => (
        <div key={category} className="space-y-6">
          {/* 分類標題 */}
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold tracking-[0.2em] uppercase text-[var(--color-morning-mist)] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
              {category}
            </h3>
            <span className="h-px flex-1 bg-white/5"></span>
            <span className="text-[10px] font-bold text-[var(--color-cloud-mist)] font-mono tracking-widest">
              {groupedSkills[category].length} UNITS
            </span>
          </div>

          {/* Skills 網格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {groupedSkills[category].map((skill) => (
                <SkillCard
                  key={skill.name}
                  skill={skill}
                  isSelected={selectedSkills.includes(skill.name)}
                  onToggle={onToggleSkill}
                  onNavigateToDoc={onNavigateToDoc}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
}
