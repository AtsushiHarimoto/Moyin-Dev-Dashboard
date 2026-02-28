import { createCategoryPanelStore } from './createPanelStore';

export const useIssuesStore = createCategoryPanelStore({
  name: 'IssuesStore',
  storageKey: 'moyin-issues-storage',
  defaultCategory: 'DOING',
});
