/**
 * Dashboard Component (iOS Paging Edition)
 * Full-screen horizontal scrolling with distinct "Overview" and "Monitor" pages.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';

import { useSkills, useProfiles, useProfile, useSyncSkills } from '../../hooks/useSkills';
import { useI18n } from '../../i18n';

// Components
import { DashboardOverview } from './DashboardOverview';
import { SkillsMonitor } from './SkillsMonitor';
import { ProfileSelector } from '../skills/ProfileSelector';

export function Dashboard() {
  const { t } = useI18n();
  // Data Fetching
  const { data: skills, isLoading: isLoadingSkills } = useSkills();
  const { data: profiles, isLoading: isLoadingProfiles } = useProfiles();
  const { mutate: sync, isPending: isSyncing } = useSyncSkills();

  // State
  const [selectedProfileName, setSelectedProfileName] = useState<string | null>(null);
  const { data: currentProfile } = useProfile(selectedProfileName);
  const [modifiedSkills, setModifiedSkills] = useState<string[]>([]);
  const [activePage, setActivePage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize profile
  useEffect(() => {
    if (profiles && profiles.length > 0 && !selectedProfileName) {
      const defaultProfile = profiles.find(p => p.name === 'cc-full') || profiles[0];
      setSelectedProfileName(defaultProfile.name);
    }
  }, [profiles, selectedProfileName]);

  // Sync profile data
  useEffect(() => {
    if (currentProfile) {
      setModifiedSkills(currentProfile.skills || []);
    }
  }, [currentProfile]);

  // Mouse Drag to Scroll (Swipe)
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Handle Scroll Snap & Page Detection
  const handleScroll = useCallback(() => {
    if (isDraggingRef.current) return;
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const width = scrollContainerRef.current.clientWidth;
      const newPage = Math.round(scrollLeft / width);
      setActivePage(prev => prev !== newPage ? newPage : prev);
    }
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    if (scrollContainerRef.current) {
        startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
        // Disable snap while dragging
        scrollContainerRef.current.style.scrollSnapType = 'none';
        scrollContainerRef.current.style.cursor = 'grabbing';
    }
  };

  const onMouseLeave = () => {
    if (!isDraggingRef.current) return;
    stopDragging();
  };

  const onMouseUp = () => {
    if (!isDraggingRef.current) return;
    stopDragging();
  };

  const stopDragging = () => {
    isDraggingRef.current = false;
    if (scrollContainerRef.current) {
        scrollContainerRef.current.style.scrollSnapType = 'x mandatory';
        scrollContainerRef.current.style.cursor = 'grab';
        
        // Manual snap on release
        const width = scrollContainerRef.current.clientWidth;
        const currentScroll = scrollContainerRef.current.scrollLeft;
        const page = Math.round(currentScroll / width);
        scrollContainerRef.current.scrollTo({
            left: page * width,
            behavior: 'smooth'
        });
        setActivePage(page);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const scrollToPage = (index: number) => {
     if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
           left: index * scrollContainerRef.current.clientWidth,
           behavior: 'smooth'
        });
     }
  };

  if (isLoadingSkills || isLoadingProfiles) {
    return (
       <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background-dark">
      {/* 1. Header (Fixed) */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-background-dark/80 backdrop-blur-md z-30 shrink-0 select-none">
         <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-[var(--color-moonlight)] tracking-widest uppercase">
              Moyin <span className="text-primary">Dev</span>
            </h1>
            <div className="h-6 w-px bg-white/10"></div>
            <ProfileSelector 
               profiles={profiles || []}
               currentProfile={selectedProfileName}
               onSelectProfile={setSelectedProfileName}
               onCreateProfile={() => {}}
            />
         </div>
         <div className="flex items-center gap-4">
             <button
               onClick={() => sync()}
               disabled={isSyncing}
               className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-all text-xs font-bold text-[var(--color-morning-mist)]",
                  isSyncing && "animate-pulse"
               )}
            >
               <span className={clsx("material-icons text-sm", isSyncing && "animate-spin")}>sync</span>
               {isSyncing ? t('dashboard.syncing') : t('dashboard.sync')}
            </button>
         </div>
      </header>

      {/* 2. Scroll Snap Container (Pages) */}
      <div 
         ref={scrollContainerRef}
         onScroll={handleScroll}
         onMouseDown={onMouseDown}
         onMouseLeave={onMouseLeave}
         onMouseUp={onMouseUp}
         onMouseMove={onMouseMove}
         className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex w-full scrollbar-none cursor-grab select-none active:cursor-grabbing"
      >
         {/* Page 1: Overview */}
         <div className="w-full h-full flex-shrink-0 snap-center overflow-hidden relative">
            <DashboardOverview 
               skills={skills || []}
               currentProfile={currentProfile || null}
               modifiedSkills={modifiedSkills}
            />
         </div>

         {/* Page 2: Skills Monitor */}
         <div className="w-full h-full flex-shrink-0 snap-center overflow-hidden relative">
            <SkillsMonitor 
               skills={skills || []}
               enabledSkills={modifiedSkills}
            />
         </div>
      </div>

      {/* 3. Page Indicators (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex gap-3 p-2 rounded-full glass-panel">
         {[0, 1].map((idx) => (
            <button
               key={idx}
               onClick={() => scrollToPage(idx)}
               className={clsx(
                  "w-2.5 h-2.5 rounded-full transition-all duration-300",
                  activePage === idx 
                     ? "bg-primary w-8 shadow-[0_0_10px_var(--color-sakura-pink)]" 
                     : "bg-white/20 hover:bg-white/40"
               )}
            />
         ))}
      </div>
    </div>
  );
}
