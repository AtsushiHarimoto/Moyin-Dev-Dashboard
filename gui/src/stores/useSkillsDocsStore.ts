import { createPanelStore } from './createPanelStore';

export const useSkillsDocsStore = createPanelStore({
  name: 'SkillsDocsStore',
  storageKey: 'moyin-skills-docs-storage',
});
