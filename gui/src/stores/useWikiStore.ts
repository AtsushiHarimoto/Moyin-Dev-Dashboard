import { createCategoryPanelStore } from './createPanelStore';

export const useWikiStore = createCategoryPanelStore({
  name: 'WikiStore',
  storageKey: 'moyin-wiki-storage',
  defaultCategory: 'projects',
});
