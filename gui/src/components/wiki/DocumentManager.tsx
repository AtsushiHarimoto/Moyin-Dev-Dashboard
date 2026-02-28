import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { wikiApi } from '../../utils/api';
import { useWikiProjects, useWikiFiles, useWikiContent } from '../../hooks/useWiki';
import { useI18n } from '../../i18n';
import { WikiSection, parseTocHeadings, parseSections } from './MarkdownRenderer';

/**
 * Document Manager Configuration
 */
export interface DocumentManagerConfig {
  // Category settings
  categories?: Array<{ value: string; label: string }>;
  defaultCategory?: string;
  showCategorySelector?: boolean;

  // Labels and i18n keys
  titleKey: string;
  subtitleKey: string;
  searchPlaceholderKey: string;
  onThisPageKey: string;
  categoryLabelKey?: (category: string) => string;
  docsBadgeText?: string;

  // Persistence store
  useStore: () => {
    selectedCategory?: string;
    selectedProjectId: string | null;
    selectedFileId: string | null;
    leftSidebarCollapsed: boolean;
    tocCollapsed: boolean;
    setSelectedCategory?: (category: string) => void;
    setSelectedProjectId: (id: string | null) => void;
    setSelectedFileId: (id: string | null) => void;
    setLeftSidebarCollapsed: (collapsed: boolean) => void;
    setTocCollapsed: (collapsed: boolean) => void;
  };
}

/**
 * Generic Document Manager Component
 * 通用文檔管理器組件
 */
export const DocumentManager: React.FC<{ config: DocumentManagerConfig }> = ({ config }) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Get state from store
  const store = config.useStore();
  const {
    selectedCategory,
    selectedProjectId,
    selectedFileId,
    leftSidebarCollapsed,
    tocCollapsed,
    setSelectedCategory,
    setSelectedProjectId,
    setSelectedFileId,
    setLeftSidebarCollapsed,
    setTocCollapsed,
  } = store;

  // Local states (not persisted)
  const [searchTerm, setSearchTerm] = useState('');

  // Ref for auto-scrolling to selected file
  const selectedFileRef = React.useRef<HTMLButtonElement>(null);
  const sidebarScrollRef = React.useRef<HTMLDivElement>(null);

  // Sync Mutation
  const { mutate: handleSync, isPending: isSyncing } = useMutation({
    mutationFn: () => wikiApi.syncWiki(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] });
    }
  });

  // Determine the active category
  const activeCategory = selectedCategory || config.defaultCategory || 'knowledge';

  // Data Hooks
  const { data: projects, isLoading: projectsLoading } = useWikiProjects(activeCategory);
  const { data: files, isLoading: filesLoading } = useWikiFiles(selectedProjectId);
  const { data: content, isLoading: contentLoading } = useWikiContent(selectedFileId);

  // Filter projects
  const filteredProjects = projects?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const markdown = content?.content || '';
  const parsedSections = React.useMemo(() => parseSections(markdown), [markdown]);
  const parsedHeadings = React.useMemo(() => parseTocHeadings(markdown), [markdown]);

  // Track previous category to detect user-initiated changes
  const prevCategoryRef = React.useRef<string | undefined>(undefined);

  // Reset selection when user manually changes category (not on mount)
  useEffect(() => {
    // Skip on first render (component mount)
    if (prevCategoryRef.current === undefined) {
      prevCategoryRef.current = activeCategory;
      return;
    }

    // Only reset if category changed by user action
    if (prevCategoryRef.current !== activeCategory) {
      setSelectedProjectId(null);
      setSelectedFileId(null);
      prevCategoryRef.current = activeCategory;
    }
  }, [activeCategory, setSelectedProjectId, setSelectedFileId]);

  // Auto-scroll to selected file when it changes
  useEffect(() => {
    if (selectedFileId && selectedFileRef.current && sidebarScrollRef.current) {
      // Small delay to ensure DOM is ready after file list expansion
      setTimeout(() => {
        selectedFileRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }, 300); // Match the AnimatePresence duration
    }
  }, [selectedFileId]);

  return (
    <div className="flex h-full animate-fade-in relative z-10">
      {/* Left Sidebar: Navigation */}
      <motion.div
        className="flex flex-col border-r border-white/5 bg-surface-dark/50 backdrop-blur-xl relative"
        animate={{ width: leftSidebarCollapsed ? 48 : 320 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Collapse Toggle Button */}
        <motion.button
          onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
          className="absolute -right-3.5 top-6 z-10 w-7 h-7 rounded-lg bg-moonlight/5 hover:bg-moonlight/10 border border-moonlight/10 flex items-center justify-center text-[var(--color-morning-mist)] hover:text-primary transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title={leftSidebarCollapsed ? '展開側欄' : '收起側欄'}
        >
          <span className="material-icons text-base">
            {leftSidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </motion.button>

        {/* Header & Scope Selector */}
        <AnimatePresence>
          {!leftSidebarCollapsed && (
            <motion.div
              className="p-6 border-b border-white/5 space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-moonlight)] tracking-tight">{t(config.titleKey)}</h2>
                  <p className="text-xs text-morning-mist mt-1">{t(config.subtitleKey)}</p>
                </div>

                <button
                  onClick={() => handleSync()}
                  disabled={isSyncing}
                  className={clsx(
                    "w-7 h-7 rounded-lg bg-moonlight/5 hover:bg-moonlight/10 text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] transition-all flex items-center justify-center",
                    isSyncing && "animate-spin cursor-not-allowed text-primary"
                  )}
                  title={t('wiki.sync')}
                >
                  <span className="material-icons text-base">sync</span>
                </button>
              </div>

              {/* Category Selector (optional) */}
              {config.showCategorySelector && config.categories && setSelectedCategory && (
                <div className="flex bg-[var(--color-dark-purple)]/20 p-1 rounded-xl border border-white/5">
                  {config.categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={clsx(
                        "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                        activeCategory === cat.value
                          ? "bg-primary text-[var(--color-moonlight)] shadow-lg shadow-primary/20"
                          : "text-morning-mist hover:text-[var(--color-moonlight)] hover:bg-moonlight/5"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Search Projects */}
              <div className="relative group">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-morning-mist)] group-focus-within:text-primary transition-colors text-lg">search</span>
                <input
                  type="text"
                  placeholder={t(config.searchPlaceholderKey)}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-moonlight/5 border border-moonlight/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--color-moonlight)] focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-[var(--color-cloud-mist)]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Project & File List */}
        <AnimatePresence>
          {!leftSidebarCollapsed && (
            <motion.div
              ref={sidebarScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-sakura"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {projectsLoading ? (
                <div className="text-center py-8 text-morning-mist animate-pulse">{t('wiki.loading')}</div>
              ) : (
                filteredProjects?.map(project => (
                  <div key={project.id} className="space-y-1">
                    {/* Project Header */}
                    <button
                      onClick={() => setSelectedProjectId(project.id === selectedProjectId ? null : project.id)}
                      className={clsx(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group",
                        selectedProjectId === project.id
                          ? "bg-moonlight/10 text-[var(--color-moonlight)] border border-moonlight/10"
                          : "hover:bg-moonlight/5 text-morning-mist hover:text-[var(--color-moonlight)] border border-transparent"
                      )}
                    >
                      <span className={clsx(
                        "material-icons text-lg transition-colors",
                        selectedProjectId === project.id ? "text-primary" : "text-[var(--color-cloud-mist)] group-hover:text-primary/70"
                      )}>folder</span>
                      <span className="text-sm font-medium truncate flex-1">{project.name}</span>
                      {selectedProjectId === project.id && (
                        <span className="material-icons text-base opacity-50">expand_more</span>
                      )}
                    </button>

                    {/* File List (Sub-level) */}
                    <AnimatePresence>
                      {selectedProjectId === project.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden ml-4 pl-4 border-l border-moonlight/10 space-y-1"
                        >
                          {filesLoading ? (
                            <div className="py-2 text-xs text-[var(--color-morning-mist)] pl-2">Loading files...</div>
                          ) : files && files.length > 0 ? (
                            files.map(file => (
                              <button
                                key={file.id}
                                ref={selectedFileId === file.id ? selectedFileRef : null}
                                onClick={() => setSelectedFileId(file.id)}
                                className={clsx(
                                  "w-full flex items-center gap-2 py-2 px-3 rounded-lg text-xs transition-all text-left",
                                  selectedFileId === file.id
                                    ? "bg-primary/20 text-primary border border-primary/20 neon-glow"
                                    : "text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)] hover:bg-moonlight/5 border border-transparent"
                                )}
                              >
                                <span className="material-icons text-sm">article</span>
                                <span className="truncate">{file.name.replace('.md', '')}</span>
                              </button>
                            ))
                          ) : (
                            <div className="py-2 text-xs text-[var(--color-cloud-mist)] pl-2">{t('wiki.empty')}</div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative bg-background-dark">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <div className="flex-1 overflow-y-auto scrollbar-wiki scroll-smooth">
          <div className="max-w-4xl mx-auto px-8 py-10 lg:px-12 lg:py-14 min-h-screen">
          {contentLoading ? (
             <div className="flex items-center justify-center h-64 text-[var(--color-morning-mist)] animate-pulse">
               <span className="material-icons mr-2">hourglass_empty</span>
               {t('wiki.loading')}
             </div>
          ) : content ? (
            <>
              {/* Breadcrumbs */}
              <nav aria-label="Breadcrumb" className="flex mb-6">
                <ol className="flex items-center space-x-2">
                  <li>
                    <button type="button" className="text-[var(--color-morning-mist)] hover:text-primary transition-colors bg-transparent border-none cursor-pointer">
                      <span className="material-icons text-sm">home</span>
                    </button>
                  </li>
                  <li className="text-[var(--color-cloud-mist)]">/</li>
                  <li>
                    <span className="text-[var(--color-morning-mist)] hover:text-primary transition-colors text-sm font-medium">
                      {config.categoryLabelKey ? t(config.categoryLabelKey(activeCategory)) : t(config.titleKey)}
                    </span>
                  </li>
                  <li className="text-[var(--color-cloud-mist)]">/</li>
                  <li>
                    <span className="text-[var(--color-morning-mist)] hover:text-primary transition-colors text-sm font-medium">
                      {projects?.find(p => p.id === selectedProjectId)?.name}
                    </span>
                  </li>
                  <li className="text-[var(--color-cloud-mist)]">/</li>
                  <li><span aria-current="page" className="text-primary text-sm font-medium">{content.name}</span></li>
                </ol>
              </nav>

              {/* Page Header */}
              <div className="mb-10 border-b border-moonlight/10 pb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-2 py-1 text-xs font-semibold bg-primary/20 text-primary-glow border border-primary/30 rounded uppercase tracking-wider">
                    {config.docsBadgeText || 'DOCS'}
                  </span>
                  <span className="text-xs text-[var(--color-morning-mist)]">Last updated: {new Date(content.updatedAt).toLocaleDateString()}</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-[var(--color-moonlight)] tracking-tight mb-4">{content.name.replace('.md', '')}</h1>
              </div>

              {/* Content Body - Rendered as Sections */}
              <article>
                    {parsedSections.map((section, idx) => (
                        <WikiSection
                            key={idx}
                            id={section.id}
                            title={section.title}
                            content={section.content}
                            defaultOpen={true}
                        />
                    ))}
              </article>

              <footer className="mt-20 text-center text-sm text-[var(--color-cloud-mist)] pb-10">
                <p>&copy; {new Date().getFullYear()} Moyin Inc. Documentation licensed under CC BY 4.0.</p>
              </footer>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] text-[var(--color-morning-mist)]">
               <span className="material-icons text-6xl opacity-20 mb-4">auto_stories</span>
               <p className="text-lg font-medium">{t('wiki.empty')}</p>
               <p className="text-sm opacity-60 max-w-xs text-center mt-2">Select a project and file from the sidebar to start reading.</p>
            </div>
          )}
          </div>
        </div>

        {/* Right Sidebar (TOC) */}
        <motion.aside
          className="hidden xl:flex flex-col z-20 py-10 overflow-hidden scrollbar-wiki border-l border-white/5 bg-[var(--color-dark-purple)]/20"
          animate={{ width: tocCollapsed ? 48 : 256 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
            <motion.div
              className="sticky top-6"
              animate={{ paddingLeft: tocCollapsed ? 10 : 24, paddingRight: tocCollapsed ? 10 : 24 }}
              transition={{ duration: 0.3 }}
            >
                <div className={clsx(
                  "flex items-center mb-4",
                  tocCollapsed ? "justify-center" : "justify-between"
                )}>
                  <AnimatePresence>
                    {!tocCollapsed && (
                      <motion.h5
                        className="text-xs font-bold text-[var(--color-morning-mist)] uppercase tracking-wider whitespace-nowrap"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {t(config.onThisPageKey)}
                      </motion.h5>
                    )}
                  </AnimatePresence>
                  <motion.button
                    onClick={() => setTocCollapsed(!tocCollapsed)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-moonlight/10 bg-moonlight/5 text-[var(--color-morning-mist)] hover:text-primary transition-colors flex-shrink-0"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    title={tocCollapsed ? '展開目錄' : '收起目錄'}
                  >
                    <span className="material-icons text-base">
                      {tocCollapsed ? 'chevron_left' : 'chevron_right'}
                    </span>
                  </motion.button>
                </div>
                <AnimatePresence>
                  {!tocCollapsed && (
                    <motion.ul
                      className="space-y-1.5 border-l border-moonlight/10 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-wiki pr-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {parsedHeadings.map((heading, i) => {
                        const indent = heading.level <= 1 ? 0 : (heading.level - 1) * 12;
                        return (
                          <li key={i} style={{ paddingLeft: `${indent + 16}px` }} className="border-l-2 border-transparent hover:border-[var(--color-cloud-mist)] transition-colors">
                            <button
                              onClick={() => document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                              className={clsx(
                                "block truncate transition-colors text-left w-full",
                                heading.level === 1 && "text-sm font-semibold text-[var(--color-moonlight)] hover:text-[var(--color-moonlight)]",
                                heading.level === 2 && "text-sm text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)]",
                                heading.level >= 3 && "text-xs text-[var(--color-morning-mist)] hover:text-[var(--color-moonlight)]",
                              )}
                              title={heading.title}
                            >
                              {heading.title}
                            </button>
                          </li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
            </motion.div>
        </motion.aside>
      </div>

      {/* Right ambient decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[100px] pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2"></div>
    </div>
  );
};
