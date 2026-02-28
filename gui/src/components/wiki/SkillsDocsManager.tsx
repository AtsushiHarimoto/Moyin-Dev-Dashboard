import React from 'react';
import { DocumentManager, DocumentManagerConfig } from './DocumentManager';
import { useSkillsDocsStore } from '../../stores/useSkillsDocsStore';

/**
 * Skills Documentation Manager
 * 管理技能文檔（.agent/skills-all）
 */
export const SkillsDocsManager: React.FC = () => {
  const config: DocumentManagerConfig = {
    // No categories - skills-all is a flat structure
    defaultCategory: 'skills-all',
    showCategorySelector: false,

    // Labels and i18n keys
    titleKey: 'skills-docs.title',
    subtitleKey: 'skills-docs.subtitle',
    searchPlaceholderKey: 'skills-docs.searchPlaceholder',
    onThisPageKey: 'skills-docs.onThisPage',
    docsBadgeText: 'SKILL',

    // Persistence store
    useStore: useSkillsDocsStore,
  };

  return <DocumentManager config={config} />;
};
