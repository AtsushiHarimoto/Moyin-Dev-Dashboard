import React from 'react';
import { DocumentManager, DocumentManagerConfig } from './DocumentManager';
import { useKnowledgeStore } from '../../stores/useKnowledgeStore';

/**
 * Knowledge Manager
 * 瀏覽系統架構、開發指南與技術知識文檔
 */
export const KnowledgeManager: React.FC = () => {
  const config: DocumentManagerConfig = {
    // No category selector for knowledge
    defaultCategory: 'knowledge',
    showCategorySelector: false,

    // Labels and i18n keys
    titleKey: 'knowledge.title',
    subtitleKey: 'knowledge.subtitle',
    searchPlaceholderKey: 'knowledge.searchPlaceholder',
    onThisPageKey: 'knowledge.onThisPage',
    docsBadgeText: 'KNOWLEDGE',

    // Persistence store
    useStore: useKnowledgeStore,
  };

  return <DocumentManager config={config} />;
};
