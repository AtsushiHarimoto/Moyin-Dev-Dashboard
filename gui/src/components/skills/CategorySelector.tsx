import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useI18n } from '../../i18n';

interface CategorySelectorProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function CategorySelector({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategorySelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
    }
  };

  return (
    <div className="relative w-full md:w-64" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full h-[46px] flex items-center justify-between px-4 rounded-2xl bg-moonlight/5 border border-moonlight/10 group cursor-pointer hover:bg-moonlight/10 transition-all focus:outline-none focus:ring-1 focus:ring-primary/40"
      >
        <span className={clsx(
          "text-sm font-medium transition-colors",
          selectedCategory ? "text-[var(--color-moonlight)]" : "text-[var(--color-morning-mist)]"
        )}>
          {selectedCategory || t('skills.allCategories')}
        </span>
        <span className={clsx(
          "material-icons text-[var(--color-morning-mist)] transition-transform duration-300",
          isOpen && "rotate-180"
        )}>
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 right-0 mt-2 z-50 py-2 rounded-2xl border border-white/10 bg-surface-dark/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
              <div className="max-h-60 overflow-y-auto scrollbar-none" role="listbox">
                <button
                  role="option"
                  aria-selected={!selectedCategory}
                  onClick={() => { onSelectCategory(null); setIsOpen(false); }}
                  className={clsx(
                    "w-full text-left px-4 py-2.5 text-xs font-bold tracking-wide transition-all",
                    !selectedCategory ? "text-primary bg-primary/10" : "text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] hover:bg-moonlight/5"
                  )}
                >
                  {t('skills.allCategories')}
                </button>

                {categories.map((category) => (
                  <button
                    key={category}
                    role="option"
                    aria-selected={selectedCategory === category}
                    onClick={() => { onSelectCategory(category); setIsOpen(false); }}
                    className={clsx(
                      "w-full text-left px-4 py-2.5 text-xs font-bold tracking-wide transition-all",
                      selectedCategory === category ? "text-primary bg-primary/10" : "text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] hover:bg-moonlight/5"
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
