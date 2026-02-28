import React from 'react';
import { DocumentManager, DocumentManagerConfig } from './DocumentManager';
import { useWikiStore } from '../../stores/useWikiStore';

/**
 * Project Wiki Manager
 * 瀏覽與閱讀項目文檔
 */
export const WikiManager: React.FC = () => {
  const config: DocumentManagerConfig = {
    // Category settings
    categories: [
      { value: 'projects', label: '00_Projects' },
      { value: 'tools', label: 'Tools' },
    ],
    defaultCategory: 'projects',
    showCategorySelector: true,

    // Labels and i18n keys
    titleKey: 'wiki.title',
    subtitleKey: 'wiki.subtitle',
    searchPlaceholderKey: 'wiki.searchPlaceholder',
    onThisPageKey: 'wiki.onThisPage',
    categoryLabelKey: (category: string) =>
      category === 'projects' ? 'wiki.category.projects' : 'wiki.category.tools',
    docsBadgeText: 'DOCS',

    // Persistence store
    useStore: useWikiStore,
  };

  return <DocumentManager config={config} />;
};
