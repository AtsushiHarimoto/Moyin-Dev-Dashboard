/**
 * ProfileSelector 組件
 * 採用高端極簡設計，與 Header 融為一體
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { ProfileSummary } from '../../types';
import { useI18n } from '../../i18n';

interface ProfileSelectorProps {
  profiles: ProfileSummary[];
  currentProfile: string | null;
  onSelectProfile: (name: string) => void;
  onCreateProfile: (name: string, description: string) => void;
}

export function ProfileSelector({
  profiles,
  currentProfile,
  onSelectProfile,
  onCreateProfile,
}: ProfileSelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProfiles = profiles.filter(profile => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return (
      profile.name.toLowerCase().includes(query) ||
      (profile.description && profile.description.toLowerCase().includes(query))
    );
  });

  const handleCreate = () => {
    if (!newProfileName.trim()) return;
    onCreateProfile(newProfileName.trim(), newProfileDescription.trim());
    setNewProfileName('');
    setNewProfileDescription('');
    setIsCreating(false);
  };

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
    <div className="relative" onKeyDown={handleKeyDown}>
      {/* Active Selection Indicator (Dropdown Trigger) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center gap-2.5 px-4 py-2 rounded-full glass-panel border border-moonlight/10 group cursor-pointer hover:bg-moonlight/5 transition-all"
      >
        <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
        <span className="text-[11px] font-bold text-[var(--color-moonlight)] group-hover:text-[var(--color-moonlight)] uppercase tracking-wider">
          {currentProfile || t('skills.profile.selectProfile')} <span className="text-[var(--color-morning-mist)] ml-1 font-normal">{t('skills.profile.active')}</span>
        </span>
        <span className={clsx("material-icons text-sm text-[var(--color-morning-mist)] transition-transform duration-300", isOpen && "rotate-180")}>
          expand_more
        </span>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => { setIsOpen(false); setIsCreating(false); }}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-80 z-50 rounded-2xl border border-white/10 bg-surface-dark/95 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {!isCreating ? (
                <>
                  {/* Search Header */}
                  <div className="p-4 border-b border-moonlight/5 bg-moonlight/5">
                    <div className="relative">
                      <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-morning-mist)] text-sm">search</span>
                      <input
                        className="w-full bg-moonlight/5 border border-moonlight/5 rounded-xl py-2 pl-9 pr-4 text-xs text-[var(--color-moonlight)] placeholder-[var(--color-cloud-mist)] focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                        placeholder={t('skills.profile.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="max-h-64 overflow-y-auto p-2 space-y-1 scrollbar-none" role="listbox">
                    {filteredProfiles.map(p => (
                      <button
                        key={p.name}
                        role="option"
                        aria-selected={currentProfile === p.name}
                        onClick={() => { onSelectProfile(p.name); setIsOpen(false); }}
                        className={clsx(
                          "w-full text-left p-3 rounded-xl transition-all group/p",
                          currentProfile === p.name ? "bg-primary/10" : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex justify-between items-center mb-0.5">
                          <span className={clsx("text-xs font-bold tracking-tight", currentProfile === p.name ? "text-primary" : "text-[var(--color-moonlight)]")}>
                            {p.name}
                          </span>
                          <span className="text-[9px] font-bold text-[var(--color-cloud-mist)] group-hover/p:text-[var(--color-morning-mist)]">{p.skillCount} SKILLS</span>
                        </div>
                        {p.description && <p className="text-[10px] text-morning-mist truncate opacity-60">{p.description}</p>}
                      </button>
                    ))}
                  </div>

                  {/* Footer Action */}
                  <div className="p-2 border-t border-moonlight/5">
                    <button
                      onClick={() => setIsCreating(true)}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] hover:bg-moonlight/5 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-icons text-sm">add</span>
                      {t('skills.profile.createNew')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--color-moonlight)] uppercase tracking-widest">{t('skills.profile.newProfile')}</h4>
                    <button onClick={() => setIsCreating(false)} className="text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)]">
                      <span className="material-icons text-base">close</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--color-morning-mist)] uppercase">{t('skills.profile.profileName')}</label>
                      <input
                        className="w-full bg-moonlight/5 border border-moonlight/10 rounded-xl py-2.5 px-4 text-xs text-[var(--color-moonlight)] focus:outline-none focus:ring-1 focus:ring-primary/40"
                        placeholder={t('skills.profile.namePlaceholder')}
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--color-morning-mist)] uppercase">{t('skills.profile.description')}</label>
                      <input
                        className="w-full bg-moonlight/5 border border-moonlight/10 rounded-xl py-2.5 px-4 text-xs text-[var(--color-moonlight)] focus:outline-none focus:ring-1 focus:ring-primary/40"
                        placeholder={t('skills.profile.descPlaceholder')}
                        value={newProfileDescription}
                        onChange={(e) => setNewProfileDescription(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={handleCreate}
                      disabled={!newProfileName.trim()}
                      className="w-full sakura-btn py-3 rounded-xl text-[11px] font-bold tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-icons text-sm">check</span>
                      {t('skills.profile.create')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
