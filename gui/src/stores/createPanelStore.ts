import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from './safeStorage';

// Base state shared by all panel stores
export interface BasePanelState {
  selectedProjectId: string | null;
  selectedFileId: string | null;
  leftSidebarCollapsed: boolean;
  tocCollapsed: boolean;

  setSelectedProjectId: (id: string | null) => void;
  setSelectedFileId: (id: string | null) => void;
  setLeftSidebarCollapsed: (collapsed: boolean) => void;
  setTocCollapsed: (collapsed: boolean) => void;
  resetSelection: () => void;
}

// Extended state for stores that have a category selector (Issues, Wiki)
export interface CategoryPanelState extends BasePanelState {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

/**
 * Create a panel store WITHOUT a category selector.
 * The storageKey must match the original persist `name` to preserve user state.
 */
export function createPanelStore(config: {
  name: string;
  storageKey: string;
}) {
  return create<BasePanelState>()(
    persist(
      (set) => ({
        selectedProjectId: null,
        selectedFileId: null,
        leftSidebarCollapsed: false,
        tocCollapsed: false,

        setSelectedProjectId: (id) => set({ selectedProjectId: id }),
        setSelectedFileId: (id) => set({ selectedFileId: id }),
        setLeftSidebarCollapsed: (collapsed) => set({ leftSidebarCollapsed: collapsed }),
        setTocCollapsed: (collapsed) => set({ tocCollapsed: collapsed }),
        resetSelection: () => set({ selectedProjectId: null, selectedFileId: null }),
      }),
      {
        name: config.storageKey,
        storage: createSafeStorage(config.name),
        partialize: (state) => ({
          selectedProjectId: state.selectedProjectId,
          selectedFileId: state.selectedFileId,
        }),
      }
    )
  );
}

/**
 * Create a panel store WITH a category selector.
 * The storageKey must match the original persist `name` to preserve user state.
 */
export function createCategoryPanelStore(config: {
  name: string;
  storageKey: string;
  defaultCategory: string;
}) {
  return create<CategoryPanelState>()(
    persist(
      (set) => ({
        selectedCategory: config.defaultCategory,
        selectedProjectId: null,
        selectedFileId: null,
        leftSidebarCollapsed: false,
        tocCollapsed: false,

        setSelectedCategory: (category) => set({ selectedCategory: category }),
        setSelectedProjectId: (id) => set({ selectedProjectId: id }),
        setSelectedFileId: (id) => set({ selectedFileId: id }),
        setLeftSidebarCollapsed: (collapsed) => set({ leftSidebarCollapsed: collapsed }),
        setTocCollapsed: (collapsed) => set({ tocCollapsed: collapsed }),
        resetSelection: () => set({ selectedProjectId: null, selectedFileId: null }),
      }),
      {
        name: config.storageKey,
        storage: createSafeStorage(config.name),
        partialize: (state) => ({
          selectedCategory: state.selectedCategory,
          selectedProjectId: state.selectedProjectId,
          selectedFileId: state.selectedFileId,
        }),
      }
    )
  );
}
