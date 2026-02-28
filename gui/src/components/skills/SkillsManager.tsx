/**
 * SkillsManager 組件
 * 重構後的佈局，採用高端玻璃擬態設計
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useSkills, useProfiles, useProfile, useSaveProfile, useSyncSkills, useCategories } from '../../hooks/useSkills';
import { useWikiProjects } from '../../hooks/useWiki';
import { wikiApi } from '../../utils/api';
import { useI18n } from '../../i18n';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { useSkillsDocsStore } from '../../stores/useSkillsDocsStore';
import { toast } from '../common/Toast';
import { CategorySelector } from './CategorySelector';
import { ProfileSelector } from './ProfileSelector';
import { SkillsGrid } from './SkillsGrid';

export function SkillsManager() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: skills, isLoading: isLoadingSkills } = useSkills();
  const { data: profiles, isLoading: isLoadingProfiles } = useProfiles();
  const { data: categoriesData } = useCategories();
  const { mutate: sync, isPending: isSyncing } = useSyncSkills();

  // Navigation stores
  const { setMode } = useNavigationStore();
  const { setSelectedProjectId, setSelectedFileId } = useSkillsDocsStore();

  // Fetch skills-all projects and files for navigation
  const { data: skillsDocsProjects, isLoading: isLoadingProjects, isError: isProjectsError } = useWikiProjects('skills-all');
  
  const [selectedProfileName, setSelectedProfileName] = useState<string | null>(null);
  const { data: currentProfile } = useProfile(selectedProfileName);
  const { mutate: saveProfileMutation, isPending: isSaving } = useSaveProfile();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modifiedSkills, setModifiedSkills] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化：當載入 profiles 後自動選擇第一個
  useEffect(() => {
    if (profiles && profiles.length > 0 && !selectedProfileName) {
      setSelectedProfileName(profiles[0].name);
    }
  }, [profiles, selectedProfileName]);

  // 當 Profile 切換或讀取成功時同步狀態
  useEffect(() => {
    if (currentProfile) {
      setModifiedSkills(currentProfile.skills || []);
    }
  }, [currentProfile]);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function toggleSkill(skillName: string): void {
    setModifiedSkills((prev) =>
      prev.includes(skillName)
        ? prev.filter((s) => s !== skillName)
        : [...prev, skillName]
    );
  }

  function handleSave(): void {
    if (!selectedProfileName || !currentProfile) return;

    saveProfileMutation({
      name: selectedProfileName,
      data: { ...currentProfile, skills: modifiedSkills },
    }, {
      onSuccess: () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaveSuccess(true);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000);
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
      },
    });
  }

  function handleCreateProfile(name: string, desc: string): void {
    saveProfileMutation({
      name,
      data: { name, description: desc, skills: [] },
    }, {
      onSuccess: () => {
        setSelectedProfileName(name);
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
      },
    });
  }

  const categories = categoriesData || [];
  const isLoading = isLoadingSkills || isLoadingProfiles;

  const hasChanges = useMemo(() => {
    const profileSkills = currentProfile?.skills || [];
    if (modifiedSkills.length !== profileSkills.length) return true;
    const profileSet = new Set(profileSkills);
    return modifiedSkills.some(s => !profileSet.has(s));
  }, [modifiedSkills, currentProfile?.skills]);

  /**
   * 用途：導航至技能文檔頁面，自動選中 skill.md 文件
   * 副作用：設定 navigation store 的 mode / projectId / fileId
   *
   * @param skillName 技能名稱，用於比對文檔專案名
   *                  Skill name used to match the doc project.
   */
  async function handleNavigateToDoc(skillName: string): Promise<void> {
    const trimmedName = skillName.trim();
    if (!trimmedName) {
      console.error('[SkillsManager] Invalid skill name provided');
      return;
    }

    // Handle loading state
    if (isLoadingProjects) {
      toast.info('文檔正在載入中，請稍候再試。');
      return;
    }

    // Handle error state
    if (isProjectsError) {
      toast.error('載入文檔失敗，無法載入 Skills 文檔列表。請檢查網路連接或重新整理頁面。');
      return;
    }

    // Handle empty state
    if (!skillsDocsProjects || skillsDocsProjects.length === 0) {
      toast.error('未找到 Skills 文檔，請先同步文檔數據。');
      return;
    }

    // Normalize names for robust matching (remove special chars, spaces, hyphens, underscores)
    const normalizeName = (name: string) =>
      name.toLowerCase().trim().replace(/[_\s-]/g, '');

    const matchingProject = skillsDocsProjects.find(
      (project) => normalizeName(project.name) === normalizeName(trimmedName)
    );

    if (!matchingProject) {
      toast.error(`未找到技能「${trimmedName}」的匹配文檔。文檔可能尚未創建或需要重新同步。`);
      return;
    }

    // Fetch files for the matched project
    try {
      const files = await queryClient.fetchQuery({
        queryKey: ['wiki', 'files', matchingProject.id],
        queryFn: () => wikiApi.getFiles(matchingProject.id),
      });

      if (!files || files.length === 0) {
        toast.info(`技能「${trimmedName}」的項目中沒有任何文檔，請檢查該技能目錄是否包含 Markdown 文件。`);
        // Still navigate to show the empty project
        setSelectedProjectId(matchingProject.id);
        setSelectedFileId(null);
        setMode('skills-docs');
        return;
      }

      // Try to find skill.md (case-insensitive)
      let targetFile = files.find(
        (file) => normalizeName(file.name) === 'skillmd'
      );

      // Fallback: try to find README.md
      if (!targetFile) {
        targetFile = files.find(
          (file) => normalizeName(file.name) === 'readmemd'
        );
      }

      // Fallback: use the first .md file
      if (!targetFile) {
        targetFile = files.find((file) => file.name.toLowerCase().endsWith('.md'));
      }

      // Final fallback: use the very first file
      if (!targetFile) {
        targetFile = files[0];
      }

      // Navigate with both project and file selected
      setSelectedProjectId(matchingProject.id);
      setSelectedFileId(targetFile.id);
      setMode('skills-docs');
    } catch (error) {
      console.error('[SkillsManager] Failed to fetch files:', error);
      toast.error('載入文件失敗，無法載入該技能的文檔文件列表。請檢查網路連接或重試。');
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-moonlight/5 bg-background-dark/50 backdrop-blur-md z-20 sticky top-0 shrink-0">
        {/* Breadcrumbs */}
        <div className="flex items-center text-xs font-medium tracking-wide">
          <span className="text-cloud-mist hover:text-morning-mist cursor-pointer transition-colors uppercase">{t('skills.breadcrumbs.home')}</span>
          <span className="mx-3 text-[var(--color-cloud-mist)]">/</span>
          <span className="text-cloud-mist hover:text-morning-mist cursor-pointer transition-colors uppercase">{t('skills.breadcrumbs.skills')}</span>
          <span className="mx-3 text-[var(--color-cloud-mist)]">/</span>
          <span className="text-[var(--color-moonlight)] text-glow uppercase">{t('skills.breadcrumbs.config')}</span>
        </div>
        
        {/* Profile Selector integration */}
        <div className="flex items-center gap-6">
          <ProfileSelector
            profiles={profiles || []}
            currentProfile={selectedProfileName}
            onSelectProfile={setSelectedProfileName}
            onCreateProfile={handleCreateProfile}
          />
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 relative pb-32 scrollbar-none">
        {/* Page Title Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-[var(--color-moonlight)] tracking-tight">{t('skills.title')}</h2>
            <p className="text-morning-mist max-w-xl text-sm leading-relaxed">{t('skills.subtitle')}</p>
          </div>
          <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-2.5 border border-primary/20 bg-primary/5">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_var(--color-sakura-pink)]"></span>
            <span className="text-[10px] font-bold text-primary tracking-widest uppercase">{t('skills.syncActive')}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 group w-full">
               <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-morning-mist)] group-focus-within:text-primary transition-colors">search</span>
               <input
                 type="text"
                 placeholder={t('skills.searchPlaceholder')}
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-moonlight/5 border border-moonlight/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-[var(--color-moonlight)] focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all font-medium"
               />
            </div>
            <CategorySelector
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
        </div>

        {/* Skills Grid Section */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
             <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
             <span className="text-sm font-bold text-[var(--color-morning-mist)] tracking-widest">{t('reports.loading')}</span>
          </div>
        ) : (
          <SkillsGrid
            skills={skills || []}
            selectedSkills={modifiedSkills}
            onToggleSkill={toggleSkill}
            onNavigateToDoc={handleNavigateToDoc}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
          />
        )}
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {(hasChanges || saveSuccess) && (
          <motion.div
            key="action-bar"
            initial={{ y: 100, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 100, x: '-50%', opacity: 0 }}
            className="fixed bottom-8 left-1/2 z-50 pointer-events-none"
          >
            <div className="glass-panel p-2 pl-6 pr-2 rounded-[24px] flex items-center gap-6 border border-moonlight/10 shadow-2xl pointer-events-auto">
              <div className="flex flex-col">
                <span className={clsx(
                  "text-[10px] font-bold uppercase tracking-widest",
                  saveSuccess ? "text-primary" : "text-[var(--color-morning-mist)]"
                )}>
                  {saveSuccess
                    ? t('skills.saveSuccess')
                    : t('skills.stats.selected', { count: modifiedSkills.length })
                  }
                </span>
                {hasChanges && !saveSuccess && (
                  <span className="text-[9px] font-bold text-warning uppercase tracking-tighter animate-pulse">{t('skills.unsavedChanges')}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => sync()}
                  disabled={isSyncing}
                  className="px-6 py-2.5 rounded-2xl text-xs font-bold text-[var(--color-moonlight)] hover:text-[var(--color-moonlight)] hover:bg-moonlight/5 transition-all disabled:opacity-50"
                >
                  {t('skills.actionBar.sync')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!selectedProfileName || isSaving || !hasChanges}
                  className="sakura-btn flex items-center gap-2 px-8 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-50 disabled:grayscale"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-moonlight/20 border-t-moonlight rounded-full animate-spin"></span>
                  ) : (
                    <span className="material-icons text-lg">save</span>
                  )}
                  {t('skills.actionBar.save')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
