import { createPanelStore } from './createPanelStore';

export const useKnowledgeStore = createPanelStore({
  name: 'KnowledgeStore',
  storageKey: 'moyin-knowledge-storage',
});
