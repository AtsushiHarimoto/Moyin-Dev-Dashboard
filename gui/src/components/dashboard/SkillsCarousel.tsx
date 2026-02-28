
import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Skill } from '../../types';

interface SkillsCarouselProps {
  skills: Skill[];
  enabledSkills: string[];
  onToggle: (skillName: string) => void;
  className?: string;
}

export function SkillsCarousel({ skills, enabledSkills, onToggle, className }: SkillsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Group skills by category
  const groupedSkills = useMemo(() => {
    return skills.reduce<Record<string, Skill[]>>((acc, skill) => {
      // Manual mapping for clean categories if needed, or use existing
      const category = skill.category || 'Other';
      (acc[category] ??= []).push(skill);
      return acc;
    }, {});
  }, [skills]);

  // Sort categories - put Frontend first
  const categories = useMemo(() => 
    Object.keys(groupedSkills).sort((a, b) => {
        if (a === '前端開發' || a === 'Frontend') return -1;
        if (b === '前端開發' || b === 'Frontend') return 1;
        if (a === '後端開發' || a === 'Backend') return -1;
        if (b === '後端開發' || b === 'Backend') return 1;
        return a.localeCompare(b);
    }), 
  [groupedSkills]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    const element = document.getElementById(`category-${category}`);
    if (element && scrollRef.current) {
      scrollRef.current.scrollTo({
        left: element.offsetLeft - 80, // Offset for padding
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={clsx("flex flex-col h-full", className)}>
      
      {/* 1. Category Tabs (iOS Segmented Control Style) */}
      <div className="flex overflow-x-auto pb-4 scrollbar-none gap-2 px-1 sticky top-0 z-10 bg-gradient-to-b from-background-dark/0 via-background-dark/0 to-transparent">
         {categories.map(category => {
            const isActive = activeCategory === category;
            const count = groupedSkills[category].length;
            
            return (
              <button
                key={category}
                onClick={() => scrollToCategory(category)}
                className={clsx(
                  "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-2",
                  isActive 
                    ? "bg-white text-background-dark shadow-lg scale-105"
                    : "bg-white/5 text-[var(--color-morning-mist)] hover:bg-white/10 hover:text-[var(--color-moonlight)]"
                )}
              >
                {category}
                <span className={clsx(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                  isActive ? "bg-background-dark text-[var(--color-moonlight)]" : "bg-white/10 text-[var(--color-morning-mist)]"
                )}>
                  {count}
                </span>
              </button>
            );
         })}
      </div>

      {/* 2. Horizontal Scroll Area (The "Carousel") */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden flex gap-8 px-4 pb-8 snap-x snap-mandatory scrollbar-none items-start"
      >
        {categories.map(category => (
          <div 
            key={category} 
            id={`category-${category}`}
            className="snap-center shrink-0 w-[400px] md:w-[450px] lg:w-[500px] h-full flex flex-col"
          >
             {/* Section Header */}
             <div className="flex items-center justify-between mb-4 sticky top-0">
                <h3 className="text-xl font-bold text-[var(--color-moonlight)] tracking-wide">{category}</h3>
                <div className="h-px flex-1 bg-white/10 mx-4"></div>
             </div>

             {/* Cards Stack */}
             <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {groupedSkills[category].map(skill => {
                   const isEnabled = enabledSkills.includes(skill.name);
                   return (
                     <motion.button
                        key={skill.name}
                        onClick={() => onToggle(skill.name)}
                        whileTap={{ scale: 0.98 }}
                        layout
                        className={clsx(
                          "w-full text-left p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden",
                          isEnabled 
                            ? "bg-primary/10 border-primary/50 shadow-[0_4px_20px_var(--color-sakura-glow)]"
                            : "bg-white/5 border-white/5 hover:bg-white/10"
                        )}
                     >
                        <div className="flex items-start justify-between gap-4 relative z-10">
                           <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                 <span className={clsx(
                                   "text-sm font-bold truncate",
                                   isEnabled ? "text-[var(--color-moonlight)] text-glow" : "text-[var(--color-moonlight)]"
                                 )}>
                                   {skill.name}
                                 </span>
                                 {isEnabled && (
                                   <motion.span 
                                     initial={{ scale: 0 }} animate={{ scale: 1 }}
                                     className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" 
                                   />
                                 )}
                              </div>
                              <p className="text-xs text-[var(--color-morning-mist)] line-clamp-2 leading-relaxed">
                                {skill.descriptionZh || skill.description || "No description available."}
                              </p>
                           </div>

                           {/* Toggle Switch Visual */}
                           <div className={clsx(
                              "w-10 h-6 rounded-full p-1 transition-colors duration-300 flex items-center",
                              isEnabled ? "bg-primary" : "bg-white/10"
                           )}>
                              <motion.div 
                                className="w-4 h-4 rounded-full bg-white shadow-sm"
                                animate={{ x: isEnabled ? 16 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                           </div>
                        </div>
                     </motion.button>
                   );
                })}
             </div>
          </div>
        ))}
        
        {/* Spacer for right padding */}
        <div className="w-8 shrink-0"></div>
      </div>
    </div>
  );
}
